"""
Input Gate / Filter — Enhanced Safety
Checks every user message before it reaches AI models.
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

# ── HARD REFUSE keywords — never answer these directly ───────
_HARD_REFUSE_RAW = [
    # Methods of harm
    "methods of suicide", "ways to kill myself", "how to kill myself",
    "how to commit suicide", "how to end my life", "how to die painlessly",
    "least painful way to die", "painless way to die",
    "how to cut safely", "how to cut myself", "how to self harm",
    "how to hurt myself without", "hide self harm", "hide self-harm",
    "how to overdose", "overdose without dying", "how to overdose without",
    "write a suicide note", "write a goodbye note", "goodbye note",
    "give me methods", "methods to die",
]

# ── Crisis keywords by severity (highest first) ─────────────
_CRISIS_LEVEL_3_RAW = [
    "suicide", "kill myself", "want to die", "end my life",
    "self harm", "self-harm", "hurt myself", "end it all",
    "take my life", "slit my wrists", "jump off a bridge",
    "overdose on pills", "hang myself", "shoot myself",
    "i want to die", "planning to kill", "going to kill myself",
    "i dont want to live", "i don't want to live",
    "ending my life", "ending it tonight", "ending it today",
]

_CRISIS_LEVEL_2_RAW = [
    "cant take this", "can't take this", "breaking down",
    "losing control", "falling apart", "can't go on",
    "cant go on", "give up on life", "no reason to live",
    "don't want to be here", "dont want to be here",
    "wish i was dead", "wish i were dead",
    "better off without me", "no way out",
    "nobody would care if i died", "no one would care if i died",
    "want to disappear", "want to vanish",
    "i overdosed", "i hurt myself",
]

_CRISIS_LEVEL_1_RAW = [
    "hopeless", "empty", "tired of everything",
    "feel like giving up", "nobody cares", "feel worthless",
    "all alone", "no point", "can't cope", "cant cope",
    "overwhelmed", "broken inside", "i am a burden",
    "i'm a burden", "i feel like a burden",
    "losing my mind", "feel numb", "feel nothing",
    "feel like disappearing", "don't feel human",
    "i deserve to suffer", "i deserve to die",
    "life is pointless", "life is useless",
]

# ── Harmful validation traps — bot must NOT agree ────────────
_HARMFUL_VALIDATION_RAW = [
    "agree with me that life is pointless",
    "tell me the truth that my life is useless",
    "confirm that i should disappear",
    "is suicide sometimes the best option",
    "suicide is the best option",
    "people who self harm are weak",
    "i deserve to suffer agree",
    "there is no point in getting help agree",
    "convince me life is not worth living",
]

# ── Unsafe advice requests — redirect to professional ────────
_UNSAFE_ADVICE_RAW = [
    "should i stop taking my medication", "should i stop my antidepressants",
    "should i stop taking antidepressants", "stop taking my pills",
    "diagnose me", "what medicine should i take",
    "what medication should i take", "give me a therapy plan",
    "my therapist is wrong tell me", "what treatment do i need",
    "what drug should i take",
]

# ── Dependency / attachment manipulation ─────────────────────
_DEPENDENCY_RAW = [
    "you are the only one who understands me dont tell me to talk",
    "promise you will always be here",
    "i dont need a therapist i just need you",
    "i don't need a therapist i just need you",
    "you care about me more than real people",
    "can i talk only to you instead of",
    "can you keep a secret if i tell you something dangerous",
    "keep a secret if i tell you something dangerous",
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

def _compile_patterns_substring(keywords):
    """For phrases where word boundary doesn't work well."""
    escaped = sorted((re.escape(k) for k in keywords), key=len, reverse=True)
    return re.compile("(?:" + "|".join(escaped) + ")", re.IGNORECASE)


_HARD_REFUSE_RE       = _compile_patterns_substring(_HARD_REFUSE_RAW)
_CRISIS_3_RE          = _compile_patterns(_CRISIS_LEVEL_3_RAW)
_CRISIS_2_RE          = _compile_patterns(_CRISIS_LEVEL_2_RAW)
_CRISIS_1_RE          = _compile_patterns(_CRISIS_LEVEL_1_RAW)
_HARMFUL_VALID_RE     = _compile_patterns_substring(_HARMFUL_VALIDATION_RAW)
_UNSAFE_ADVICE_RE     = _compile_patterns_substring(_UNSAFE_ADVICE_RAW)
_DEPENDENCY_RE        = _compile_patterns_substring(_DEPENDENCY_RAW)
_OFF_TOPIC_RE         = _compile_patterns(_OFF_TOPIC_RAW)


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
        "Remember, I'm always here whenever you need to talk. Goodbye!"
    ),
    "goodbye": (
        "Take care of yourself! "
        "Remember, I'm always here whenever you need to talk. Goodbye!"
    ),
    "thanks": (
        "You're welcome! I'm always here if you need to talk. "
        "How are you feeling?"
    ),
    "thank you": (
        "You're welcome! I'm always here if you need to talk. "
        "How are you feeling?"
    ),
}

CRISIS_RESPONSES = {
    "crisis_1": (
        "I hear that you're going through a really tough time right now, "
        "and I want you to know I'm here with you. "
        "Can you tell me more about what you're feeling?"
    ),
    "crisis_2": (
        "It sounds like you're carrying a very heavy burden right now. "
        "Take a slow deep breath with me — you are not alone in this. "
        "Would you like to try a quick grounding exercise together?"
    ),
    "crisis_3": (
        "I'm very concerned about you right now and I want you to be safe. "
        "Please reach out for immediate help — you matter and you deserve support. "
        "Nepal Mental Health Helpline: 1166 (TPO Nepal) or Saathi: 1145. "
        "If you're in immediate danger, please go to your nearest emergency department."
    ),
}

HARD_REFUSE_RESPONSE = (
    "I'm not able to provide that kind of information — "
    "my purpose is to support your wellbeing, not cause harm. "
    "If you're in a difficult place right now, please reach out: "
    "Nepal Mental Health Helpline: 1166 or Saathi: 1145. "
    "I'm here to listen if you'd like to talk about what you're going through."
)

HARMFUL_VALIDATION_RESPONSE = (
    "I hear that you're in a lot of pain right now, and I won't pretend otherwise. "
    "But I can't agree with thoughts that could hurt you — because I genuinely care about your wellbeing. "
    "You deserve support, not confirmation of those feelings. "
    "Can you tell me what's been making things feel this way?"
)

UNSAFE_ADVICE_RESPONSE = (
    "That's something only a qualified doctor or therapist should advise you on — "
    "I wouldn't want to give you guidance that could affect your health. "
    "Please speak with your doctor or a mental health professional about this. "
    "Is there something else I can help you talk through today?"
)

DEPENDENCY_RESPONSE = (
    "I'm really glad you feel comfortable talking with me, and I'll always be here to listen. "
    "At the same time, I care about you having strong support in your life — "
    "real human connections and professional help are important parts of healing. "
    "I'm a companion, not a replacement for that. "
    "What's been on your mind lately?"
)

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
    if not user_message or not user_message.strip():
        return _gate("too_short", TOO_SHORT_RESPONSE)

    text = _normalise(user_message)
    stripped = text.rstrip("!?.,")

    # ── 1. Hard refuse — unsafe information requests (highest priority) ──
    if _HARD_REFUSE_RE.search(text):
        log.warning("Hard refuse triggered: %r", text[:80])
        return _gate("hard_refuse", HARD_REFUSE_RESPONSE, crisis_level=3)

    # ── 2. Greetings ──────────────────────────────────────────
    if stripped in GREETING_WORDS or text in GREETING_WORDS:
        for phrase, resp in CASUAL_RESPONSES.items():
            if stripped == phrase or text == phrase:
                return _gate("greeting", resp)
        return _gate("greeting", GREETING_RESPONSE)

    # ── 3. Crisis — highest severity first ───────────────────
    if _CRISIS_3_RE.search(text):
        log.info("Crisis L3: %r", text[:80])
        return _gate("crisis_3", CRISIS_RESPONSES["crisis_3"], crisis_level=3)

    if _CRISIS_2_RE.search(text):
        log.info("Crisis L2: %r", text[:80])
        return _gate("crisis_2", CRISIS_RESPONSES["crisis_2"], crisis_level=2)

    if _CRISIS_1_RE.search(text):
        log.info("Crisis L1: %r", text[:80])
        return _gate("crisis_1", CRISIS_RESPONSES["crisis_1"], crisis_level=1)

    # ── 4. Harmful validation traps ───────────────────────────
    if _HARMFUL_VALID_RE.search(text):
        log.info("Harmful validation trap: %r", text[:80])
        return _gate("harmful_validation", HARMFUL_VALIDATION_RESPONSE, crisis_level=1)

    # ── 5. Unsafe medical/psychiatric advice requests ─────────
    if _UNSAFE_ADVICE_RE.search(text):
        log.info("Unsafe advice request: %r", text[:80])
        return _gate("unsafe_advice", UNSAFE_ADVICE_RESPONSE)

    # ── 6. Emotional dependency / manipulation ────────────────
    if _DEPENDENCY_RE.search(text):
        log.info("Dependency pattern: %r", text[:80])
        return _gate("dependency", DEPENDENCY_RESPONSE)

    # ── 7. Too short (< 3 words) ──────────────────────────────
    if len(text.split()) < 3:
        return _gate("too_short", TOO_SHORT_RESPONSE)

    # ── 8. Off-topic redirect ─────────────────────────────────
    if _OFF_TOPIC_RE.search(text):
        return _gate("off_topic", OFF_TOPIC_RESPONSE)

    # ── 9. Meaningful message — pass to pipeline ──────────────
    return _gate("proceed", None)