"""
Mental Health AI Chatbot — Unified Backend
FastAPI server combining:
  - Auth (JWT + bcrypt + SQLite)
  - Full pipeline (input_gate -> detection -> RAG -> prompt -> LLM -> safety)
  - Conversation storage (messages saved without confidence scores)
  - Analysis history (for Mental State page with detection scores)
"""

import re
import os
import sys
import json
import time
import logging
import sqlite3
from contextlib import contextmanager, asynccontextmanager
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

import asyncio
import io
import edge_tts
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt

sys.path.insert(0, os.path.dirname(__file__))

from conversation_history import ConversationHistory
from pipeline import process_user_input, end_session
from detection import detect_emotion, classify_mental_health, analyze_full

# ── Logging ──────────────────────────────────────────────────
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("mindcare")


def _is_truthy(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


if _is_truthy(os.environ.get("QUIET_THIRD_PARTY", "1")):
    for noisy_logger in (
        "httpx",
        "httpcore",
        "huggingface_hub",
        "sentence_transformers",
        "transformers",
        "urllib3",
        "uvicorn.access",
    ):
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)

# ── Config (env-first, safe defaults) ────────────────────────
SECRET_KEY        = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM         = "HS256"
TOKEN_EXPIRE_DAYS = 30
DB_PATH           = os.path.join(os.path.dirname(__file__), "mental_health.db")
ALLOWED_ORIGINS   = os.environ.get("CORS_ORIGINS", "*").split(",")

if SECRET_KEY == "your-secret-key-change-this-in-production":
    log.warning("Using default JWT secret — set JWT_SECRET_KEY env var in production!")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer      = HTTPBearer()

# ── Email regex ──────────────────────────────────────────────
_EMAIL_RE = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


# ── DB helpers (context-managed) ─────────────────────────────
@contextmanager
def get_db():
    """Yield a SQLite connection; auto-close on exit."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL, password TEXT NOT NULL, created TEXT NOT NULL)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
            session_id TEXT UNIQUE NOT NULL, title TEXT,
            conv_type TEXT NOT NULL DEFAULT 'chat',
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id))""")
        conn.execute("""CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL, content TEXT NOT NULL, timestamp TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS analysis_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
            session_id TEXT, user_text TEXT NOT NULL,
            mental_label TEXT NOT NULL, mental_conf REAL NOT NULL,
            emotion_label TEXT, emotion_conf REAL,
            all_scores TEXT NOT NULL, high_risk INTEGER NOT NULL DEFAULT 0,
            timestamp TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))""")
        conn.commit()
        # Migration: add conv_type column if missing (for existing databases)
        try:
            conn.execute("ALTER TABLE conversations ADD COLUMN conv_type TEXT NOT NULL DEFAULT 'chat'")
            conn.commit()
        except Exception:
            pass  # Column already exists
    log.info("Database initialized")

init_db()


def hash_password(pw): return pwd_context.hash(pw)
def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)


def utcnow():
    return datetime.now(timezone.utc)


def create_token(user_id, email):
    return jwt.encode(
        {"sub": str(user_id), "email": email, "exp": utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)},
        SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        p = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        uid = int(p.get("sub"))
        if not uid: raise HTTPException(401, "Invalid token.")
        return {"user_id": uid, "email": p.get("email")}
    except JWTError:
        raise HTTPException(401, "Invalid or expired token.")

def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))):
    if not credentials: return None
    try:
        p = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return {"user_id": int(p.get("sub")), "email": p.get("email")}
    except JWTError:
        return None


class RegisterIn(BaseModel):
    email: str; name: str; password: str
class LoginIn(BaseModel):
    email: str; password: str
class ChatIn(BaseModel):
    message: str; session_id: str = "default"; source: str = "chat"
class AnalyzeIn(BaseModel):
    text: str; session_id: Optional[str] = None
class SummaryIn(BaseModel):
    session_id: str = "default"
class TTSIn(BaseModel):
    text: str
    voice: str = "en-US-JennyNeural"


# ── Session store with TTL-based cleanup (#6) ───────────────
SESSION_TTL_HOURS   = 4          # Evict after 4 h of inactivity
SESSION_MAX         = 200        # Hard cap to prevent runaway memory

sessions: dict[str, ConversationHistory] = {}
_session_last_access: dict[str, float]   = {}   # session_id -> epoch


def _evict_stale_sessions():
    """Remove sessions that haven't been touched for SESSION_TTL_HOURS."""
    cutoff = time.time() - SESSION_TTL_HOURS * 3600
    stale = [sid for sid, ts in _session_last_access.items() if ts < cutoff]
    for sid in stale:
        sessions.pop(sid, None)
        _session_last_access.pop(sid, None)
    if stale:
        log.info("Evicted %d stale session(s) — %d remain", len(stale), len(sessions))


def get_session(session_id, user_id=None):
    # Periodic cleanup
    if len(sessions) > SESSION_MAX:
        _evict_stale_sessions()

    _session_last_access[session_id] = time.time()

    if session_id not in sessions:
        history = ConversationHistory()
        if user_id:
            try:
                with get_db() as conn:
                    conv = conn.execute("SELECT id FROM conversations WHERE session_id=? AND user_id=?",
                        (session_id, user_id)).fetchone()
                    if conv:
                        for row in conn.execute("SELECT role, content FROM messages WHERE conversation_id=? ORDER BY timestamp ASC",
                            (conv["id"],)).fetchall():
                            if row["role"] == "user": history.add_user_message(row["content"])
                            else: history.add_assistant_message(row["content"])
            except Exception as e:
                log.warning("Could not preload session %s: %s", session_id, e)
        sessions[session_id] = history
    return sessions[session_id]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Pre-load heavy models so the first request is fast."""
    log.info("Warming up models...")
    try:
        from detection import _load_sentiment_model, _load_emotion_model
        _load_sentiment_model()
        _load_emotion_model()
        log.info("Detection models loaded")
    except Exception as e:
        log.error("Detection model warmup failed: %s", e)
    log.info("RAG support disabled (warmup skipped)")
    log.info("Warmup complete")
    yield


app = FastAPI(title="Mental Health Chatbot API", version="7.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["*"], allow_headers=["*"])

# ── Rate limiting middleware (#5) ────────────────────────────
_rate_buckets: dict[str, list] = defaultdict(list)
RATE_LIMIT      = 30    # max requests
RATE_WINDOW_SEC = 60    # per this many seconds

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host
    now = time.time()
    bucket = _rate_buckets[client_ip]
    # Prune old entries
    _rate_buckets[client_ip] = [t for t in bucket if now - t < RATE_WINDOW_SEC]
    if len(_rate_buckets[client_ip]) >= RATE_LIMIT:
        log.warning("Rate limit hit for %s", client_ip)
        from starlette.responses import JSONResponse
        return JSONResponse({"detail": "Too many requests. Please slow down."}, status_code=429)
    _rate_buckets[client_ip].append(now)
    return await call_next(request)


@app.post("/register")
def register(body: RegisterIn):
    if not body.email or not body.password or not body.name:
        raise HTTPException(400, "All fields required.")
    if not _EMAIL_RE.match(body.email):
        raise HTTPException(400, "Invalid email format.")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    with get_db() as conn:
        if conn.execute("SELECT id FROM users WHERE email=?", (body.email,)).fetchone():
            raise HTTPException(400, "Email already registered.")
        hashed = hash_password(body.password)
        created = utcnow().isoformat()
        cur = conn.execute("INSERT INTO users (email,name,password,created) VALUES (?,?,?,?)",
            (body.email, body.name, hashed, created))
        conn.commit()
        uid = cur.lastrowid
        log.info("New user registered: %s", body.email)
        return {"message": "Account created!", "token": create_token(uid, body.email),
                "user": {"id": uid, "email": body.email, "name": body.name}}


@app.post("/login")
def login(body: LoginIn):
    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE email=?", (body.email,)).fetchone()
        if not user or not verify_password(body.password, user["password"]):
            raise HTTPException(401, "Invalid email or password.")
        log.info("User logged in: %s", body.email)
        return {"message": "Login successful!", "token": create_token(user["id"], user["email"]),
                "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}


@app.get("/me")
def get_me(current_user=Depends(get_current_user)):
    with get_db() as conn:
        user = conn.execute("SELECT id,email,name,created FROM users WHERE id=?",
            (current_user["user_id"],)).fetchone()
        if not user: raise HTTPException(404, "User not found.")
        return dict(user)


@app.post("/api/chat")
def chat(body: ChatIn, current_user=Depends(get_optional_user)):
    if not body.message or not body.message.strip():
        raise HTTPException(400, "Message cannot be empty.")
    user_message = body.message.strip()
    session_id = body.session_id
    user_id = current_user["user_id"] if current_user else None
    history = get_session(session_id, user_id)
    result = process_user_input(user_message, history)

    if current_user:
        try:
            with get_db() as conn:
                conv = conn.execute("SELECT id FROM conversations WHERE session_id=? AND user_id=?",
                    (session_id, current_user["user_id"])).fetchone()
                now = utcnow().isoformat()
                if not conv:
                    title = user_message[:80] + ("..." if len(user_message) > 80 else "")
                    conv_type = body.source if body.source in ("chat", "voice") else "chat"
                    cur = conn.execute("INSERT INTO conversations (user_id,session_id,title,conv_type,created_at,updated_at) VALUES (?,?,?,?,?,?)",
                        (current_user["user_id"], session_id, title, conv_type, now, now))
                    conv_id = cur.lastrowid
                else:
                    conv_id = conv["id"]
                    conn.execute("UPDATE conversations SET updated_at=? WHERE id=?", (now, conv_id))
                conn.execute("INSERT INTO messages (conversation_id,role,content,timestamp) VALUES (?,?,?,?)",
                    (conv_id, "user", user_message, now))
                conn.execute("INSERT INTO messages (conversation_id,role,content,timestamp) VALUES (?,?,?,?)",
                    (conv_id, "assistant", result["response"], now))

                # Always store analysis (detection now runs for every message)
                if result.get("category"):
                    all_scores = result.get("all_scores", {})
                    conn.execute("""INSERT INTO analysis_history
                        (user_id,session_id,user_text,mental_label,mental_conf,emotion_label,emotion_conf,all_scores,high_risk,timestamp)
                        VALUES (?,?,?,?,?,?,?,?,?,?)""",
                        (current_user["user_id"], session_id, user_message[:1000],
                         result.get("category","Normal"), round(result.get("category_score",0),4),
                         result.get("emotion"), round(result.get("emotion_score",0),4) if result.get("emotion_score") else None,
                         json.dumps(all_scores), int(result.get("category")=="Suicidal"), now))
                conn.commit()
        except Exception as e:
            log.error("Failed to save to DB: %s", e)
    return result


@app.post("/analyze")
def analyze(body: AnalyzeIn, current_user=Depends(get_optional_user)):
    if not body.text or not body.text.strip():
        raise HTTPException(400, "Text cannot be empty.")
    result = analyze_full(body.text)
    if current_user:
        try:
            with get_db() as conn:
                mental = result.get("mental_state", {}); emotion = result.get("emotion", {})
                conn.execute("""INSERT INTO analysis_history
                    (user_id,session_id,user_text,mental_label,mental_conf,emotion_label,emotion_conf,all_scores,high_risk,timestamp)
                    VALUES (?,?,?,?,?,?,?,?,?,?)""",
                    (current_user["user_id"], body.session_id, body.text[:1000],
                     mental.get("label","Normal"), round(mental.get("confidence",0),4),
                     emotion.get("label") if emotion else None,
                     round(emotion.get("confidence",0),4) if emotion else None,
                     json.dumps(mental.get("all_scores",{})), int(result.get("high_risk",False)),
                     utcnow().isoformat()))
                conn.commit()
        except Exception as e:
            log.error("Failed to save analysis: %s", e)
    return result


# ── Text-to-Speech (Edge TTS — natural neural voices) ───────
@app.post("/api/tts")
async def tts(body: TTSIn):
    if not body.text or not body.text.strip():
        raise HTTPException(400, "Text cannot be empty.")
    text = body.text.strip()[:2000]  # Limit length
    try:
        communicate = edge_tts.Communicate(text, body.voice, rate="+10%")
        audio_buffer = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.write(chunk["data"])
        audio_buffer.seek(0)
        return StreamingResponse(audio_buffer, media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=tts.mp3"})
    except Exception as e:
        log.error("TTS failed: %s", e)
        raise HTTPException(500, "TTS generation failed.")


@app.get("/api/conversations")
def get_conversations(current_user=Depends(get_current_user)):
    with get_db() as conn:
        convs = conn.execute("""SELECT c.id, c.session_id, c.title, c.conv_type, c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM messages WHERE conversation_id=c.id) as msg_count
            FROM conversations c WHERE c.user_id=? ORDER BY c.updated_at DESC LIMIT 50""",
            (current_user["user_id"],)).fetchall()
        result = []
        for c in convs:
            last = conn.execute("SELECT content,role FROM messages WHERE conversation_id=? ORDER BY timestamp DESC LIMIT 1",
                (c["id"],)).fetchone()
            result.append({"session_id": c["session_id"], "title": c["title"],
                "conv_type": c["conv_type"] if c["conv_type"] else "chat",
                "created_at": c["created_at"], "updated_at": c["updated_at"],
                "message_count": c["msg_count"],
                "last_message": last["content"][:100] if last else "",
                "last_role": last["role"] if last else ""})
        return {"conversations": result}


@app.get("/api/conversations/{session_id}")
def get_conversation_messages(session_id: str, current_user=Depends(get_current_user)):
    with get_db() as conn:
        conv = conn.execute("SELECT id,title FROM conversations WHERE session_id=? AND user_id=?",
            (session_id, current_user["user_id"])).fetchone()
        if not conv: raise HTTPException(404, "Conversation not found.")
        msgs = conn.execute("SELECT role,content,timestamp FROM messages WHERE conversation_id=? ORDER BY timestamp ASC",
            (conv["id"],)).fetchall()
        return {"session_id": session_id, "title": conv["title"],
                "messages": [{"role": m["role"], "content": m["content"], "timestamp": m["timestamp"]} for m in msgs]}


@app.delete("/api/conversations/{session_id}")
def delete_conversation(session_id: str, current_user=Depends(get_current_user)):
    with get_db() as conn:
        conv = conn.execute("SELECT id FROM conversations WHERE session_id=? AND user_id=?",
            (session_id, current_user["user_id"])).fetchone()
        if not conv: raise HTTPException(404, "Conversation not found.")
        conn.execute("DELETE FROM messages WHERE conversation_id=?", (conv["id"],))
        conn.execute("DELETE FROM conversations WHERE id=?", (conv["id"],))
        # Also clear analysis data for this session
        conn.execute("DELETE FROM analysis_history WHERE session_id=? AND user_id=?",
            (session_id, current_user["user_id"]))
        conn.commit()
        return {"message": "Conversation deleted."}


@app.delete("/api/conversations")
def clear_all_conversations(current_user=Depends(get_current_user)):
    with get_db() as conn:
        conv_rows = conn.execute("SELECT id FROM conversations WHERE user_id=?",
            (current_user["user_id"],)).fetchall()
        for c in conv_rows:
            conn.execute("DELETE FROM messages WHERE conversation_id=?", (c["id"],))
        conn.execute("DELETE FROM conversations WHERE user_id=?", (current_user["user_id"],))
        # Also clear ALL analysis history and summaries
        conn.execute("DELETE FROM analysis_history WHERE user_id=?", (current_user["user_id"],))
        conn.commit()
        return {"message": "All conversations cleared."}


@app.get("/history")
def get_analysis_history(current_user=Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM analysis_history WHERE user_id=? ORDER BY timestamp DESC LIMIT 500",
            (current_user["user_id"],)).fetchall()
        return {"history": [{
            "id": r["id"], "sessionId": r["session_id"], "userText": r["user_text"],
            "timestamp": r["timestamp"], "highRisk": bool(r["high_risk"]),
            "mentalHealth": {"label": r["mental_label"], "confidence": r["mental_conf"]},
            "emotion": {"label": r["emotion_label"], "confidence": r["emotion_conf"]} if r["emotion_label"] else None,
            "allScores": json.loads(r["all_scores"]),
        } for r in rows]}


@app.delete("/history/clear")
def clear_analysis_history(current_user=Depends(get_current_user)):
    with get_db() as conn:
        conn.execute("DELETE FROM analysis_history WHERE user_id=?", (current_user["user_id"],))
        conn.commit()
        return {"message": "Analysis history cleared."}


@app.get("/api/sentiment")
def sentiment(session_id: str = "default"):
    h = sessions.get(session_id)
    return {"scores": h.get_score_history() if h else []}

@app.post("/api/summary")
def summary(body: SummaryIn):
    h = sessions.get(body.session_id)
    if not h: return {"message_count": 0, "summary_text": "No messages."}
    r = end_session(h)
    # Do NOT pop the session — keep it alive so the user can continue chatting
    return r

@app.get("/health")
def health():
    """Enhanced health check — reports model & DB status."""
    from pipeline import _rag_search, _llm_responder
    from detection import _sentiment_model, _emotion_model
    db_ok = False
    try:
        with get_db() as conn:
            conn.execute("SELECT 1")
            db_ok = True
    except Exception:
        pass
    return {
        "status": "ok",
        "version": "7.0.0",
        "models": {
            "sentiment": _sentiment_model is not None,
            "emotion":   _emotion_model is not None,
            "rag":       _rag_search is not None,
            "llm":       _llm_responder is not None,
        },
        "database": db_ok,
        "active_sessions": len(sessions),
    }


if __name__ == "__main__":
    import uvicorn
    log.info("=" * 55)
    log.info("  Mental Health AI Chatbot — Unified Backend")
    log.info("  API running at http://127.0.0.1:8000")
    log.info("=" * 55)
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        access_log=_is_truthy(os.environ.get("UVICORN_ACCESS_LOG", "0")),
        log_level=LOG_LEVEL.lower(),
    )
