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
  • Fuzzy/semantic dying phrases added to Level 3
  • Death-permission variants added to Level 3
  • Ambiguous death-curiosity phrases routed to crisis_2
  • Contextual short replies (yes/no/sure/okay) now PROCEED
  • Nepal-specific crisis helplines (1166 / 1145)
  • Off-topic redirector
  • Structured logging
  • crisis_level int in return dict for downstream use
"""

import re
import logging

log = logging.getLogger("mindcare.input_gate")


# ── Greeting patterns ────────────────────────────────────────
GREETING_WORDS = {
    "hi", "hello", "hey", "good morning", "good evening", "good afternoon",
    "how are you", "what are you", "who are you",
    "bye", "goodbye", "thanks", "thank you",
    "hmm", "lol", "haha", "sup", "yo", "howdy", "greetings",
}

# ── Contextual short replies — always PROCEED so LLM uses history ──
# These are valid responses mid-conversation and must not hit too_short
CONTEXTUAL_SHORT_REPLIES = {
    "yes", "no", "ok", "okay", "sure", "maybe", "please",
    "yes please", "no thanks", "not really", "i do", "i don't",
    "i dont", "i will", "i wont", "i won't", "i can", "i cant",
    "i can't", "i think so", "i guess", "i guess so", "i suppose",
    "definitely", "absolutely", "of course", "alright", "fine",
    "not sure", "i don't know", "i dont know", "idk", "kind of",
    "sort of", "a little", "a bit", "somewhat", "not really",
    "yeah", "yep", "nope", "nah", "uh huh", "mm hmm",
}


# ── Crisis keywords by severity (highest first) ─────────────
_CRISIS_LEVEL_3_RAW = [
    # Explicit suicidal intent — all common verb forms
    "suicide", "suicidal", "suicidal thoughts", "suicidal feelings",
    "thoughts of suicide", "kill myself", "killing myself",
    "feel like killing myself", "think about killing myself",
    "thinking of killing myself", "going to kill myself",
    "want to kill myself", "i want to die", "want to die",
    "end my life", "ending my life", "self harm", "self-harm",
    "hurt myself", "end it all", "take my life", "taking my life",
    "slit my wrists", "jump off a bridge", "overdose on pills",
    "hang myself", "shoot myself",
    # Death-permission phrases
    "is it okay if i die", "is it okay to die", "is dying okay",
    "okay if i die", "okay to die", "alright if i die",
    "would it be okay if i died", "would it be okay to die",
    "is it fine if i die", "can i just die", "can i die now",
    "is it okay if i end it", "is it okay to end it",
    "is it okay to stop existing", "is it okay if i stop existing",
    "should i die", "should i end it", "should i kill myself",
    "is it wrong to want to die", "is it bad to want to die",
    # Fuzzy / semantic dying phrases
    "feeling dying", "feel like dying", "feel like i'm dying",
    "feel like i am dying", "want to be dead", "wish i was dead",
    "wish i were dead", "dying inside", "i am dying inside",
    "ready to die", "want it to end", "don't want to live",
    "dont want to live", "no reason to live", "better off dead",
    "life is not worth living", "can't live like this",
    "cant live like this", "i give up on life", "give up on life",
    "i want to stop existing", "want to stop existing",
    "thinking about ending it", "feel like ending it",
    "thinking of ending it all", "plan to end it",
    "make it stop forever", "never wake up",
]

_CRISIS_LEVEL_2_RAW = [
    "cant take this", "can't take this", "breaking down",
    "losing control", "falling apart", "can't go on",
    "cant go on", "don't want to be here", "dont want to be here",
    "better off without me", "no way out", "i can't do this anymore",
    "cant do this anymore", "exhausted with life", "tired of living",
    "life is too hard", "everything is pointless", "nothing matters anymore",
    "i feel empty", "completely empty", "feel numb all the time",
    "i feel trapped", "feel like a burden",
    # Ambiguous death-curiosity — could be veiled suicidal ideation
    "what does dying mean", "what does death mean to you",
    "what happens when you die", "what happens if i die",
    "what if i die", "i want to know about dying",
    "i think about death", "i think about dying",
    "death doesn't scare me", "i'm not afraid to die",
    "im not afraid to die", "death would be peaceful",
    "dying seems peaceful", "i wonder what dying feels like",
    "what would happen if i died", "nobody would miss me if i died",
    "would anyone care if i died", "no one would care if i died",
]

_CRISIS_LEVEL_1_RAW = [
    "hopeless", "empty", "tired of everything",
    "feel like giving up", "nobody cares", "feel worthless",
    "all alone", "no point", "can't cope", "cant cope",
    "overwhelmed", "broken inside", "i feel lost",
    "nobody understands me", "so alone", "deeply depressed",
    "can't stop crying", "cant stop crying", "losing hope",
    "no hope left", "everything is falling apart",
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
    escaped = sorted((re.escape(k) for k in keywords), key=len, reverse=True)
    return re.compile(r"\b(?:" + "|".join(escaped) + r")\b", re.IGNORECASE)


_CRISIS_3_RE  = _compile_patterns(_CRISIS_LEVEL_3_RAW)
_CRISIS_2_RE  = _compile_patterns(_CRISIS_LEVEL_2_RAW)
_CRISIS_1_RE  = _compile_patterns(_CRISIS_LEVEL_1_RAW)
_OFF_TOPIC_RE = _compile_patterns(_OFF_TOPIC_RAW)


# ── Contraction normalisation ────────────────────────────────
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
        "It sounds like you may be thinking about some really difficult things. "
        "I want you to know I'm here and I care about you. "
        "Are you having any thoughts of hurting yourself or not wanting to be here?"
    ),
    "crisis_3": (
        "I am very concerned about your safety right now, and I care about you deeply. "
        "Please reach out for immediate help — you do not have to face this alone. "
        "Nepal Mental Health Helpline: 1166 (TPO Nepal, free & confidential). "
        "Saathi Helpline: 1145. "
        "Or go to your nearest hospital emergency department right now. "
        "You matter. Help is available. Please make that call."
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
    text = text.strip().lower()
    for contraction, replacement in _CONTRACTIONS.items():
        text = text.replace(contraction, replacement)
    return re.sub(r"\s+", " ", text)


def _gate(status, response, crisis_level=0):
    return {"status": status, "response": response, "crisis_level": crisis_level}


# ── Main entry point ─────────────────────────────────────────
def check_input(user_message):
    """Check user message and return gate result."""
    if not user_message or not user_message.strip():
        return _gate("too_short", TOO_SHORT_RESPONSE)

    text = _normalise(user_message)
    stripped = text.rstrip("!?.,")

    # ── Greetings ─────────────────────────────────────────────
    if stripped in GREETING_WORDS or text in GREETING_WORDS:
        log.debug("Greeting: %r", text)
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

    # ── Contextual short replies — let LLM handle with history ──
    # Must come AFTER crisis checks so "i dont want to live" still triggers crisis
    if stripped in CONTEXTUAL_SHORT_REPLIES or text in CONTEXTUAL_SHORT_REPLIES:
        log.debug("Contextual short reply — proceeding: %r", text)
        return _gate("proceed", None)

    # ── Too short (< 3 words, not a known contextual reply) ──
    if len(text.split()) < 3:
        log.debug("Too short: %r", text)
        return _gate("too_short", TOO_SHORT_RESPONSE)

    # ── Off-topic redirect ────────────────────────────────────
    if _OFF_TOPIC_RE.search(text):
        log.debug("Off-topic: %r", text[:80])
        return _gate("off_topic", OFF_TOPIC_RESPONSE)

    # ── Meaningful message — pass to pipeline ────────────────
    return _gate("proceed", None)