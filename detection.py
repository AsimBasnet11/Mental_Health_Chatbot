KEYWORD_MAP = {
    "Depression": [
        r"\bdepress(ed|ion|ing)?\b", r"\bsad(ness|ly)?\b", r"\bhopeless(ness)?\b", r"\blonely|loneliness\b", r"\bworthless(ness)?\b",
        r"\bdown\b", r"\bempty\b", r"\btearful\b", r"\bunhappy\b", r"\bno motivation\b", r"\bloss of interest\b", r"\bself-hate\b",
        r"\bguilt(y)?\b", r"\bhelpless(ness)?\b", r"\btrouble sleeping\b", r"\bcan'?t concentrate\b", r"\bexhaust(ed|ion)\b"
    ],
    "Anxiety": [
        r"\banxious|anxiety\b", r"\bnervous(ness)?\b", r"\bworry|worried|worrying\b", r"\bpanic(ked|king)?\b",
        r"\brestless(ness)?\b", r"\btense|tension\b", r"\bapprehensive\b", r"\buneasy\b", r"\bfear(ful|ing)?\b",
        r"\bracing thoughts\b", r"\bcan'?t relax\b", r"\bheart racing\b", r"\bshort of breath\b", r"\bsweating\b"
    ],
    "Bipolar": [
        r"\bbipolar\b", r"\bmanic|mania\b", r"\bhighs? and lows?\b", r"\bimpulsive\b", r"\brapid cycling\b",
        r"\bgrandiose\b", r"\bhyperactive\b", r"\bpressured speech\b", r"\bracing thoughts\b", r"\bdecreased need for sleep\b"
    ],
    "Personality Disorder": [
        r"\bpersonality disorder\b", r"\bborderline\b", r"\bantisocial\b", r"\bparanoid\b", r"\bobsessive-compulsive\b",
        r"\bavoidant\b", r"\bdependent\b", r"\bschizoid\b", r"\bschizotypal\b", r"\bhistrionic\b", r"\bnarcissistic\b"
    ],
    "Suicidal": [
        r"\bsuicid(al|e)\b", r"\bend my life\b", r"\bkill myself\b", r"\bwant to die\b", r"\bno reason to live\b",
        r"\bcan'?t go on\b", r"\bnot worth living\b", r"\bgive up\b", r"\bbetter off dead\b", r"\bself-harm\b"
    ],
}

# Phrases to ignore for 'Normal' (do not count as normal)
_IGNORE_NORMAL = [
    r"\bi am feeling\b", r"\bi feel\b", r"\bi am\b", r"\bfeeling\b", r"\bnow\b"
]

def keyword_state_count(text):
    """Scan text for mental health keywords, count each state, return the state with the highest count (average if multiple)."""
    text = text.lower()
    counts = {k: 0 for k in KEYWORD_MAP}
    total = 0
    for state, patterns in KEYWORD_MAP.items():
        for pat in patterns:
            matches = re.findall(pat, text)
            if matches:
                counts[state] += len(matches)
                total += len(matches)
    # Remove ignored phrases for 'Normal'
    for pat in _IGNORE_NORMAL:
        text = re.sub(pat, "", text)
    # If no keywords found, treat as 'Normal'
    if total == 0:
        return "Normal", 1.0
    # Find state with max count (average if tie)
    max_count = max(counts.values())
    if max_count == 0:
        return "Normal", 1.0
    winners = [k for k, v in counts.items() if v == max_count]
    # If tie, pick first alphabetically
    winner = sorted(winners)[0]
    avg = max_count / sum(counts.values()) if sum(counts.values()) > 0 else 1.0
    return winner, avg
"""
Detection Module
Loads the emotion (GoEmotions) and mental health (Sentimental-analysis) models
from the Detection/ folder and provides inference functions for the pipeline.
"""

import re
import os
import logging
import numpy as np
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForSequenceClassification

log = logging.getLogger("mindcare.detection")

# ── Device ───────────────────────────────────────────────────
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── Labels ───────────────────────────────────────────────────
SENTIMENT_LABELS = [
    "Anxiety", "Bipolar", "Depression",
    "Normal", "Personality Disorder", "Suicidal"
]

EMOTION_LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval",
    "disgust", "embarrassment", "excitement", "fear", "gratitude", "grief",
    "joy", "love", "nervousness", "optimism", "pride", "realization",
    "relief", "remorse", "sadness", "surprise", "neutral",
]

SUICIDAL_IDX = SENTIMENT_LABELS.index("Suicidal")

# ── Model Paths ──────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SENTIMENT_MODEL_PATH = os.path.join(BASE_DIR, "Detection", "Sentimental-analysis")
EMOTION_MODEL_PATH = os.path.join(BASE_DIR, "Detection", "Goemotion-detection")

# ── Lazy-loaded models ───────────────────────────────────────
_sentiment_tokenizer = None
_sentiment_model = None
_emotion_tokenizer = None
_emotion_model = None


def _load_sentiment_model():
    global _sentiment_tokenizer, _sentiment_model
    if _sentiment_model is None:
        log.info("Loading sentiment model from %s...", SENTIMENT_MODEL_PATH)
        _sentiment_tokenizer = AutoTokenizer.from_pretrained(SENTIMENT_MODEL_PATH)
        _sentiment_model = AutoModelForSequenceClassification.from_pretrained(
            SENTIMENT_MODEL_PATH
        ).to(device).eval()
        log.info("Sentiment model loaded on %s", device)
    return _sentiment_tokenizer, _sentiment_model


def _load_emotion_model():
    global _emotion_tokenizer, _emotion_model
    if _emotion_model is None:
        log.info("Loading emotion model from %s...", EMOTION_MODEL_PATH)
        _emotion_tokenizer = AutoTokenizer.from_pretrained(EMOTION_MODEL_PATH)
        _emotion_model = AutoModelForSequenceClassification.from_pretrained(
            EMOTION_MODEL_PATH
        ).to(device).eval()
        log.info("Emotion model loaded on %s", device)
    return _emotion_tokenizer, _emotion_model


# ── Text cleaning ────────────────────────────────────────────
_FILLERS = re.compile(
    r"\b(you know|i mean|basically|literally|obviously|kind of|sort of"
    r"|to be honest|anyway|anyways|just saying|so basically|like i said"
    r"|i am the|the thing is|does that make sense|if that makes sense)\b"
    r"|https?://\S+|www\.\S+|@\w+"
    r"|([.!?])\2{2,}",
    re.IGNORECASE,
)


def clean(text):
    text = text.replace("\u2019", "'").replace("\u201c", '"').replace("\u201d", '"')
    text = text.lower().strip()
    text = _FILLERS.sub(" ", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text


# ── Short-text expansion ─────────────────────────────────────
# When input is very short (< 4 words) the BERT model lacks context and
# produces unreliable predictions. We wrap the short text into a neutral
# first-person sentence so the model gets enough tokens.
# Greetings and casual words are skipped — no emotional bias added.
_SHORT_MIN_WORDS = 4

_SKIP_EXPAND = {
    "hi", "hello", "hey", "bye", "goodbye", "ok", "okay", "sure",
    "yes", "no", "maybe", "thanks", "thank you", "good morning",
    "good evening", "good afternoon", "sup", "yo", "howdy", "lol",
    "haha", "hmm", "greetings", "im fine", "im good", "im okay",
    "im ok", "all good", "im great",
}


def _expand_short_text(text):
    """If text is very short, wrap into a neutral sentence for better
    model context. Returns original text if long enough or if it's a
    greeting/casual word."""
    words = text.split()
    if len(words) >= _SHORT_MIN_WORDS:
        return text
    if text.strip() in _SKIP_EXPAND:
        return text
    expanded = f"i am feeling {text} right now"
    log.debug("Short-text expanded: %r → %r", text, expanded)
    return expanded


# ── Chunking for long texts ─────────────────────────────────
MAX_LEN = 256
STRIDE = 64


def _get_chunks(text, tokenizer):
    tokens = tokenizer.encode(text, add_special_tokens=False)
    step = MAX_LEN - STRIDE - 2
    if len(tokens) <= step:
        return [text]
    chunks, start = [], 0
    while start < len(tokens):
        end = min(start + step, len(tokens))
        chunks.append(tokenizer.decode(tokens[start:end], skip_special_tokens=True))
        if end == len(tokens):
            break
        start += step
    return chunks


def _infer_best_chunk(text, tokenizer, model):
    chunks = _get_chunks(text, tokenizer)

    if len(chunks) == 1:
        # Short text — single inference, no averaging needed
        enc = tokenizer(
            chunks[0], max_length=MAX_LEN, padding="max_length",
            truncation=True, return_tensors="pt"
        ).to(device)
        with torch.no_grad():
            return F.softmax(model(**enc).logits, dim=-1)[0].cpu().numpy()

    # Long text — ensemble: weighted average of all chunk probabilities.
    # Weight each chunk by its top confidence so high-signal chunks
    # contribute more than low-signal / ambiguous ones.
    all_probs = []
    all_weights = []

    for chunk in chunks:
        enc = tokenizer(
            chunk, max_length=MAX_LEN, padding="max_length",
            truncation=True, return_tensors="pt"
        ).to(device)
        with torch.no_grad():
            probs = F.softmax(model(**enc).logits, dim=-1)[0].cpu().numpy()
        top_conf = float(probs.max())
        all_probs.append(probs)
        all_weights.append(top_conf)

    # Weighted average across chunks
    weights = np.array(all_weights)
    weights = weights / weights.sum()  # normalise to sum=1
    ensemble_probs = np.sum([w * p for w, p in zip(weights, all_probs)], axis=0)
    log.debug("Ensemble over %d chunks, weights: %s", len(chunks), np.round(weights, 3))
    return ensemble_probs


def _infer_emotion_probs(text, tokenizer, model):
    sentences = [s.strip() for s in re.split(r'[.!?]', text) if s.strip()]
    # Use last 3 sentences for longer texts, full text if short
    focused_text = '. '.join(sentences[-3:]) if len(sentences) > 3 else text

    enc = tokenizer(
        focused_text, max_length=128, padding="max_length",
        truncation=True, return_tensors="pt"
    ).to(device)
    with torch.no_grad():
        probs = F.softmax(model(**enc).logits, dim=-1)[0].cpu().numpy()
    return probs


# ── Suicidal keyword safety net ──────────────────────────────
# The model is strong but not perfect on safety-critical cases.
# These keywords act as a FLOOR — they can raise the suicidal score
# but never suppress it. Triggered only when model confidence is low.
_SUICIDAL_KEYWORDS = re.compile(
    r"\b(kill\s*(my|him|her|them)?self|suicide|suicidal|end\s*my\s*life"
    r"|want\s*to\s*die(?!\s+(?:of|from|because|so)\b)"
    r"|don'?t\s*want\s*to\s*(live|exist)|no\s*reason\s*to\s*live"
    r"|better\s*off\s*(dead|without\s*me)|take\s*my\s*(own\s*)?life"
    r"|can'?t\s*go\s*on|not\s*worth\s*living|goodbye\s*forever"
    r"|end\s*(it|everything)(?!\s+(?:all)?\s*(?:right|well|now|there))"
    r"|ending\s*(it|everything|it\s*all)"
    r"|ways?\s*to\s*die|painless\s*ways?"
    r"|if\s*i\s*(was|were)\s*gone"
    r"|nobody\s*(would|will)\s*(notice|miss|care)"
    r"|not\s*be\s*(here|around)\s*anymore"
    r"|wish\s*i\s*(wasn'?t|was\s*not|weren'?t)\s*(here|alive|born)"
    r"|wish\s*i\s*(was|were)\s*never\s*born)\b",
    re.IGNORECASE,
)

# Idiomatic phrases that should NOT trigger the suicidal safety net
_SUICIDAL_FALSE_POSITIVE_RE = re.compile(
    r"\b(could|would|gonna|going to)\s+kill\s+(for|over)\b"
    r"|\b(die|dying)\s+(of|from)\s+(embarrassment|laughter|boredom|curiosity|excitement|anticipation)\b",
    re.IGNORECASE,
)

SUICIDAL_KEYWORD_FLOOR = 0.55  # minimum suicidal confidence if keywords found


def _apply_suicidal_safety_net(probs, text):
    """If strong suicidal keywords are detected but model confidence is low,
    raise suicidal score to a safe floor and renormalise.
    This is a safety net — it never suppresses an already high score."""
    if not _SUICIDAL_KEYWORDS.search(text):
        return probs
    # Guard: skip if the match is an idiomatic phrase (e.g. "die of embarrassment")
    if _SUICIDAL_FALSE_POSITIVE_RE.search(text):
        return probs

    current_suicidal = float(probs[SUICIDAL_IDX])
    if current_suicidal >= SUICIDAL_KEYWORD_FLOOR:
        return probs  # model already caught it

    log.warning("Suicidal keyword detected — raising confidence floor from %.2f to %.2f",
                current_suicidal, SUICIDAL_KEYWORD_FLOOR)

    probs = probs.copy()
    boost = SUICIDAL_KEYWORD_FLOOR - current_suicidal
    # Distribute the boost reduction proportionally from non-suicidal labels
    other_sum = 1.0 - current_suicidal
    if other_sum > 0:
        for i in range(len(probs)):
            if i != SUICIDAL_IDX:
                probs[i] -= boost * (probs[i] / other_sum)
    probs[SUICIDAL_IDX] = SUICIDAL_KEYWORD_FLOOR
    return probs


# ── Public API ───────────────────────────────────────────────

def detect_emotion(text):
    """Detect emotion from text using GoEmotions model.

    Returns:
        (emotion_label: str, confidence: float)
    """
    tokenizer, model = _load_emotion_model()
    cleaned = clean(text)
    if not cleaned:
        return ("neutral", 0.5)

    expanded = _expand_short_text(cleaned)
    probs = _infer_emotion_probs(expanded, tokenizer, model)
    top_idx = int(probs.argmax())
    return (EMOTION_LABELS[top_idx], float(probs[top_idx]))


def classify_mental_health(text):
    """Classify mental health state using Sentimental-analysis model.

    Returns:
        (category_label: str, confidence: float)
    """
    tokenizer, model = _load_sentiment_model()
    cleaned = clean(text)
    if not cleaned:
        return ("Normal", 0.5)

    # First, try keyword-based detection
    keyword_label, keyword_avg = keyword_state_count(cleaned)
    if keyword_label != "Normal":
        return (keyword_label, keyword_avg)
    # Otherwise, use model-based detection
    expanded = _expand_short_text(cleaned)
    probs = _infer_best_chunk(expanded, tokenizer, model)
    probs = _apply_suicidal_safety_net(probs, cleaned)
    top_idx = int(np.argmax(probs))
    # Depression/Normal resolver logic
    if SENTIMENT_LABELS[top_idx] == "Normal":
        depression_idx = SENTIMENT_LABELS.index("Depression")
        depression_score = float(probs[depression_idx])
        normal_score = float(probs[top_idx])
        # If Depression is second highest and close to Normal, pick Depression
        sorted_indices = np.argsort(probs)[::-1]
        if sorted_indices[1] == depression_idx and (normal_score - depression_score) < 0.20 and depression_score > 0.15:
            return ("Depression", depression_score)
    return (SENTIMENT_LABELS[top_idx], float(probs[top_idx]))


def classify_mental_health_with_scores(text):
    """Classify mental health and also return all label scores.

    Returns:
        (category_label: str, confidence: float, all_scores: dict)
    """
    tokenizer, model = _load_sentiment_model()
    cleaned = clean(text)
    if not cleaned:
        return ("Normal", 0.5, {})

    # Always run the model to get nuanced probability distribution
    expanded = _expand_short_text(cleaned)
    probs = _infer_best_chunk(expanded, tokenizer, model)
    # Suppress model's false positive suicidal score (e.g. "die of embarrassment")
    is_false_positive = bool(_SUICIDAL_FALSE_POSITIVE_RE.search(cleaned))
    if is_false_positive and probs[SUICIDAL_IDX] > 0.3:
        probs = probs.copy()
        probs[SUICIDAL_IDX] = 0.01
        total = probs.sum()
        if total > 0:
            probs = probs / total
    probs = _apply_suicidal_safety_net(probs, cleaned)
    # Post-safety-net: if safety net raised score but phrase is false positive, revert
    if is_false_positive and probs[SUICIDAL_IDX] > 0.3:
        probs = probs.copy()
        probs[SUICIDAL_IDX] = 0.01
        total = probs.sum()
        if total > 0:
            probs = probs / total

    # Check keyword detection as a separate signal
    keyword_label, keyword_avg = keyword_state_count(cleaned)
    if keyword_label != "Normal" and keyword_label in SENTIMENT_LABELS:
        # Blend: boost the keyword-matched class with model's own probability
        # instead of replacing all scores with binary 1.0/0.0
        keyword_idx = SENTIMENT_LABELS.index(keyword_label)
        blended = probs.copy()
        keyword_boost = min(keyword_avg, 0.9)
        model_weight = 0.4
        kw_weight = 1.0 - model_weight
        blended[keyword_idx] = model_weight * float(probs[keyword_idx]) + kw_weight * keyword_boost
        total = blended.sum()
        if total > 0:
            probs = blended / total

    top_idx = int(np.argmax(probs))
    depression_idx = SENTIMENT_LABELS.index("Depression")
    depression_score = float(probs[depression_idx])
    normal_score = float(probs[SENTIMENT_LABELS.index("Normal")])
    sorted_indices = np.argsort(probs)[::-1]
    label = SENTIMENT_LABELS[top_idx]
    conf = float(probs[top_idx])
    # Depression/Normal resolver logic
    if label == "Normal":
        if sorted_indices[1] == depression_idx and (normal_score - depression_score) < 0.20 and depression_score > 0.15:
            label = "Depression"
            conf = depression_score
    all_scores = {SENTIMENT_LABELS[i]: round(float(p), 4) for i, p in enumerate(probs)}
    return (label, conf, all_scores)


def analyze_full(text):
    """Full analysis matching the Detection/main.py /analyze output format.

    Returns dict with emotion, mental_state, high_risk, suicidal_signal.
    """
    cleaned = clean(text)
    if not cleaned:
        return {
            "emotion": {"label": "neutral", "confidence": 0.5},
            "mental_state": {"label": "Normal", "confidence": 0.5,
                             "risk_level": "Low", "all_scores": {}},
            "high_risk": False,
            "suicidal_signal": {"detected": False, "confidence": 0.0,
                                "risk_level": "Low"},
        }

    expanded = _expand_short_text(cleaned)

    # Sentiment
    s_tok, s_model = _load_sentiment_model()
    s_probs = _infer_best_chunk(expanded, s_tok, s_model)
    s_probs = _apply_suicidal_safety_net(s_probs, cleaned)
    s_top_idx = int(np.argmax(s_probs))
    s_label = SENTIMENT_LABELS[s_top_idx]
    s_conf = float(s_probs[s_top_idx])
    suicidal_conf = float(s_probs[SUICIDAL_IDX])
    high_risk = s_label == "Suicidal"

    def _risk_level(conf):
        if conf >= 0.85: return "Critical"
        if conf >= 0.70: return "High"
        if conf >= 0.50: return "Moderate"
        return "Low"

    mental_state = {
        "label": s_label,
        "confidence": round(s_conf, 4),
        "risk_level": _risk_level(s_conf),
        "all_scores": {
            SENTIMENT_LABELS[i]: round(float(p), 4)
            for i, p in enumerate(s_probs)
        },
    }

    # Emotion (skip if suicidal)
    if not high_risk:
        e_tok, e_model = _load_emotion_model()
        e_probs = _infer_emotion_probs(expanded, e_tok, e_model)
        e_top_idx = int(e_probs.argmax())
        emotion = {
            "label": EMOTION_LABELS[e_top_idx],
            "confidence": round(float(e_probs[e_top_idx]), 4),
        }
    else:
        emotion = {"label": "fear", "confidence": 0.0}

    return {
        "emotion": emotion,
        "mental_state": mental_state,
        "high_risk": high_risk,
        "suicidal_signal": {
            "detected": high_risk,
            "confidence": round(suicidal_conf, 4),
            "risk_level": _risk_level(suicidal_conf),
        },
    }