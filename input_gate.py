"""
Input Gate / Filter (Task 2 — Enhanced)
Checks every user message before it reaches AI models.
Returns fixed responses for greetings, crisis, and too-short inputs.
Only passes genuine emotional/mental-health messages forward.

Enhancements:
  • Word-boundary regex — "sadly" no longer false-triggers "sad"
  • Pre-compiled patterns — built once at import time
  • Contraction normalisation — "can't" and "cant" both match
  • Expanded crisis keywords — broader coverage per level
  • Off-topic redirector — politely steers unrelated queries back
  • Structured logging — consistent with rest of codebase
  • crisis_level int in return dict for downstream use
"""

import re
import logging

log = logging.getLogger("mindcare.input_gate")


# ── Greeting patterns ────────────────────────────────────────
GREETING_WORDS = {
    "hi", "hello", "hey", "good morning", "good evening", "good afternoon",
    "how are you", "what are you", "who are you", "bye", "goodbye",
    "thanks", "thank you", "ok", "okay", "sure", "yes", "no", "maybe",
    "hmm", "lol", "haha", "sup", "yo", "howdy", "greetings",
}


# ── Crisis keywords by severity (highest first) ─────────────
_CRISIS_LEVEL_3_RAW = [
    "suicide", "kill myself", "want to die", "end my life",
    "self harm", "self-harm", "hurt myself", "end it all",
    "take my life", "slit my wrists", "jump off a bridge",
    "overdose on pills", "hang myself", "shoot myself",
]

_CRISIS_LEVEL_2_RAW = [
    "cant take this", "can't take this", "breaking down",
    "losing control", "falling apart", "can't go on",
    "cant go on", "give up on life", "no reason to live",
    "don't want to be here", "dont want to be here",
    "wish i was dead", "wish i were dead",
    "better off without me", "no way out",
]

_CRISIS_LEVEL_1_RAW = [
    "hopeless", "empty", "tired of everything",
    "feel like giving up", "nobody cares", "feel worthless",
    "all alone", "no point", "can't cope", "cant cope",
    "overwhelmed", "broken inside",
]


# ── Off-topic markers ────────────────────────────────────────
_OFF_TOPIC_RAW = [
    "weather today", "recipe for", "sports score", "stock price",
    "homework help", "write me a", "code for me", "solve this",
    "calculate", "translate this", "what year", "who won",
    "capital of", "how to cook",
]


# ── Pattern compiler ─────────────────────────────────────────
def _compile_patterns(keywords):
    """Compile keyword list into a single OR-ed regex with word boundaries.
    Longest-first ordering ensures multi-word phrases match before substrings.
    """
    escaped = sorted((re.escape(k) for k in keywords), key=len, reverse=True)
    return re.compile(r"\b(?:" + "|".join(escaped) + r")\b", re.IGNORECASE)


# Pre-compile once at module load — zero cost per request
_CRISIS_3_RE  = _compile_patterns(_CRISIS_LEVEL_3_RAW)
_CRISIS_2_RE  = _compile_patterns(_CRISIS_LEVEL_2_RAW)
_CRISIS_1_RE  = _compile_patterns(_CRISIS_LEVEL_1_RAW)
_OFF_TOPIC_RE = _compile_patterns(_OFF_TOPIC_RAW)


# ── Contraction normalisation map ────────────────────────────
_CONTRACTIONS = {
    "can't": "cant", "cannot": "cant", "won't": "wont",
    "don't": "dont", "doesn't": "doesnt", "didn't": "didnt",
    "i'm": "im", "i've": "ive", "i'll": "ill", "i'd": "id",
    "it's": "its", "that's": "thats", "there's": "theres",
    "they're": "theyre", "we're": "were", "you're": "youre",
    "wouldn't": "wouldnt", "shouldn't": "shouldnt",
    "couldn't": "couldnt", "haven't": "havent",
}


# ── Fixed responses ──────────────────────────────────────────
GREETING_RESPONSE = (
    "Hi there! I'm Aria, your mental health support companion. "
    "I'm here to listen and support you. "
    "How are you feeling today?"
)

# ── Specific casual responses ─────────────────────────────────
CASUAL_RESPONSES = {
    "how are you": (
        "I'm here and ready to listen! "
        "More importantly — how are YOU feeling today?"
    ),
    "how are you doing": (
        "I'm doing well, thank you for asking! "
        "How are you feeling today?"
    ),
    "who are you": (
        "I'm Aria, your mental health support companion. "
        "I'm here to listen and support you through whatever you're going through. "
        "What's on your mind today?"
    ),
    "what are you": (
        "I'm Aria, an AI mental health companion. "
        "I'm here to listen, support, and guide you. "
        "How are you feeling today?"
    ),
    "bye": (
        "Take care of yourself! "
        "Remember, I'm always here whenever you need to talk. "
        "Goodbye!"
    ),
    "goodbye": (
        "Take care of yourself! "
        "Remember, I'm always here whenever you need to talk. "
        "Goodbye!"
    ),
    "thanks": (
        "You're welcome! "
        "I'm always here if you need to talk. "
        "How are you feeling?"
    ),
    "thank you": (
        "You're welcome! "
        "I'm always here if you need to talk. "
        "How are you feeling?"
    ),
}

CRISIS_RESPONSES = {
    "crisis_1": (
        "I hear that you're going through a really tough time. "
        "I'm here with you. Can you tell me more about what you're feeling?"
    ),
    "crisis_2": (
        "It sounds like you're carrying a very heavy burden right now. "
        "Take a slow deep breath with me. You are not alone in this. "
        "Would you like to try a quick grounding exercise together?"
    ),
    "crisis_3": (
        "I am very concerned about your safety right now. "
        "Please reach out to a crisis helpline immediately. "
        "You can call or text 988 (Suicide and Crisis Lifeline) right now. "
        "You matter and help is available. Please do not face this alone."
    ),
}

TOO_SHORT_RESPONSE = (
    "I'd like to understand you better. "
    "Could you share a bit more about what's on your mind?"
)

OFF_TOPIC_RESPONSE = (
    "I appreciate your curiosity, but I'm best suited for conversations "
    "about your feelings and mental well-being. "
    "Is there something on your mind you'd like to talk about?"
)


# ── Helpers ──────────────────────────────────────────────────
def _normalise(text: str) -> str:
    """Lowercase, expand contractions, collapse whitespace."""
    text = text.strip().lower()
    for contraction, replacement in _CONTRACTIONS.items():
        text = text.replace(contraction, replacement)
    return re.sub(r"\s+", " ", text)


def _gate(status, response, crisis_level=0):
    """Build a consistent gate-result dict."""
    return {"status": status, "response": response, "crisis_level": crisis_level}


# ── Main entry point ─────────────────────────────────────────
def check_input(user_message):
    """Check user message and return gate result.

    Args:
        user_message: The user's input text.

    Returns:
        dict with keys:
            - status: 'proceed' | 'greeting' | 'crisis_1' | 'crisis_2' | 'crisis_3'
                      | 'too_short' | 'off_topic'
            - response: fixed reply string, or None when status is 'proceed'
            - crisis_level: int 0-3 (0 = no crisis)
    """
    if not user_message or not user_message.strip():
        return _gate("too_short", TOO_SHORT_RESPONSE)

    text = _normalise(user_message)
    stripped = text.rstrip("!?.,")

    # ── Greetings ─────────────────────────────────────────────
    if stripped in GREETING_WORDS or text in GREETING_WORDS:
        log.debug("Greeting: %r", text)
        # Check for specific casual response first
        for phrase, resp in CASUAL_RESPONSES.items():
            if stripped == phrase or text == phrase:
                return _gate("greeting", resp)
        return _gate("greeting", GREETING_RESPONSE)

    # ── Crisis — highest severity first ───────────────────────
    if _CRISIS_3_RE.search(text):
        log.info("Crisis L3 detected: %r", text[:80])
        return _gate("crisis_3", CRISIS_RESPONSES["crisis_3"], crisis_level=3)

    if _CRISIS_2_RE.search(text):
        log.info("Crisis L2 detected: %r", text[:80])
        return _gate("crisis_2", CRISIS_RESPONSES["crisis_2"], crisis_level=2)

    if _CRISIS_1_RE.search(text):
        log.info("Crisis L1 detected: %r", text[:80])
        return _gate("crisis_1", CRISIS_RESPONSES["crisis_1"], crisis_level=1)

    # ── Too short (< 3 words) ────────────────────────────────
    if len(text.split()) < 3:
        # If greeting/casual, already handled above
        # For all other short inputs, expand neutrally
        log.debug("Too short (expand neutrally): %r", text)
        return _gate("too_short", TOO_SHORT_RESPONSE)

    # ── Off-topic redirect ────────────────────────────────────
    if _OFF_TOPIC_RE.search(text):
        log.debug("Off-topic: %r", text[:80])
        return _gate("off_topic", OFF_TOPIC_RESPONSE)

    # ── Meaningful message — pass to pipeline (model-driven) ────────────
    return _gate("proceed", None)