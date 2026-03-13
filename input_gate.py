"""
Input Gate / Filter (Task 2 + Enhancement 1: Crisis Escalation Levels)
Checks every user message before it reaches AI models.
Returns fixed responses for greetings, crisis, and too-short inputs.
Only passes genuine emotional/mental health messages forward.
"""

import re

# Greeting patterns
GREETING_WORDS = {
    "hi", "hello", "hey", "good morning", "good evening", "good afternoon",
    "how are you", "what are you", "who are you", "bye", "goodbye",
    "thanks", "thank you", "ok", "okay", "sure", "yes", "no", "maybe",
    "hmm", "lol", "haha"
}

# Crisis keywords by severity level
CRISIS_LEVEL_3 = [
    "suicide", "kill myself", "want to die", "end my life",
    "self harm", "hurt myself", "end it all", "take my life"
]

CRISIS_LEVEL_2 = [
    "cant take this", "can't take this", "breaking down",
    "losing control", "falling apart", "can't go on",
    "cant go on", "give up on life", "no reason to live"
]

CRISIS_LEVEL_1 = [
    "tired of everything",
    "feel like giving up", "nobody cares", "feel worthless"
]

# Fixed responses for each category
GREETING_RESPONSE = (
    "Hello! I'm Aria, your mental health support companion. "
    "I'm here to listen and support you. How are you feeling today?"
)

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
    )
}

TOO_SHORT_RESPONSE = (
    "I'd like to understand you better. "
    "Could you share a bit more about what's on your mind?"
)


def check_input(user_message):
    """Check user message and return gate result.

    Args:
        user_message: The user's input text.

    Returns:
        dict with keys:
            - status: 'proceed', 'greeting', 'crisis_1', 'crisis_2', 'crisis_3', 'too_short'
            - response: fixed reply string or None if status is 'proceed'
    """
    if not user_message or not user_message.strip():
        return {"status": "too_short", "response": TOO_SHORT_RESPONSE}

    text = user_message.strip().lower()

    # Check too short (less than 2 words)
    if len(text.split()) < 2:
        # But first check if it's a greeting
        if text in GREETING_WORDS:
            return {"status": "greeting", "response": GREETING_RESPONSE}
        return {"status": "too_short", "response": TOO_SHORT_RESPONSE}

    # Check greetings
    for greeting in GREETING_WORDS:
        if text == greeting or text.rstrip("!?.") == greeting:
            return {"status": "greeting", "response": GREETING_RESPONSE}

    # Check crisis Level 3 first (most severe)
    for keyword in CRISIS_LEVEL_3:
        if keyword in text:
            return {"status": "crisis_3", "response": CRISIS_RESPONSES["crisis_3"]}

    # Check crisis Level 2
    for keyword in CRISIS_LEVEL_2:
        if keyword in text:
            return {"status": "crisis_2", "response": CRISIS_RESPONSES["crisis_2"]}

    # Check crisis Level 1 — these are common emotional expressions.
    # Let them proceed through the pipeline so the LLM can respond
    # with full context from emotion detection + mental health classification.
    # The models will assess actual severity.

    # Message is meaningful — proceed to pipeline
    return {"status": "proceed", "response": None}
