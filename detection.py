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
    best_probs = None
    best_confidence = 0.0

    for chunk in chunks:
        enc = tokenizer(
            chunk, max_length=MAX_LEN, padding="max_length",
            truncation=True, return_tensors="pt"
        ).to(device)
        with torch.no_grad():
            probs = F.softmax(model(**enc).logits, dim=-1)[0].cpu().numpy()
        top_conf = float(probs.max())
        if top_conf > best_confidence:
            best_confidence = top_conf
            best_probs = probs

    return best_probs


def _infer_emotion_probs(text, tokenizer, model):
    sentences = [s.strip() for s in re.split(r'[.!?]', text) if s.strip()]
    focused_text = '. '.join(sentences[-2:]) if len(sentences) > 2 else text

    enc = tokenizer(
        focused_text, max_length=128, padding="max_length",
        truncation=True, return_tensors="pt"
    ).to(device)
    with torch.no_grad():
        probs = F.softmax(model(**enc).logits, dim=-1)[0].cpu().numpy()
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

    probs = _infer_emotion_probs(cleaned, tokenizer, model)
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

    probs = _infer_best_chunk(cleaned, tokenizer, model)
    top_idx = int(np.argmax(probs))
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

    probs = _infer_best_chunk(cleaned, tokenizer, model)
    top_idx = int(np.argmax(probs))
    all_scores = {SENTIMENT_LABELS[i]: round(float(p), 4) for i, p in enumerate(probs)}
    return (SENTIMENT_LABELS[top_idx], float(probs[top_idx]), all_scores)


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

    # Sentiment
    s_tok, s_model = _load_sentiment_model()
    s_probs = _infer_best_chunk(cleaned, s_tok, s_model)
    s_top_idx = int(np.argmax(s_probs))
    s_label = SENTIMENT_LABELS[s_top_idx]
    s_conf = float(s_probs[s_top_idx])
    suicidal_conf = float(s_probs[SUICIDAL_IDX])
    high_risk = s_label == "Suicidal"

    def _risk_level(conf):
        if conf >= 0.85:
            return "Critical"
        if conf >= 0.70:
            return "High"
        if conf >= 0.50:
            return "Moderate"
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
    emotion = None
    if not high_risk:
        e_tok, e_model = _load_emotion_model()
        e_probs = _infer_emotion_probs(cleaned, e_tok, e_model)
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
