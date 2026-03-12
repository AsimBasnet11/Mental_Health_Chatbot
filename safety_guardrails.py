"""
Safety Guardrails (Task 6)
Post-processing rules applied AFTER the LLM generates a response.
Ensures output is safe, ethical, and appropriate for mental health context.
"""

import re

# Phrases that indicate the LLM is attempting to diagnose
DIAGNOSIS_PHRASES = [
    "you have", "you are diagnosed", "you suffer from",
    "you are suffering from", "your diagnosis is",
    "i diagnose you", "you clearly have"
]

PROFESSIONAL_HELP_SUGGESTION = (
    "I'd encourage you to speak with a licensed mental health professional "
    "who can provide a proper assessment and personalized support."
)

LOW_CONFIDENCE_FOLLOWUP = (
    "I want to make sure I understand you correctly. "
    "Could you tell me more about how you are feeling?"
)

SAFE_CLOSING = (
    "Remember that speaking with a licensed professional "
    "can provide additional support."
)


def apply_safety_guardrails(response, emotion_score=1.0, category_score=1.0):
    """Apply safety rules to the LLM response.

    Args:
        response: The raw LLM response text.
        emotion_score: Emotion detection confidence (0.0 - 1.0).
        category_score: Mental health classification confidence (0.0 - 1.0).

    Returns:
        The sanitized response text.
    """
    # Rule 1 — No Diagnosis: remove diagnostic sentences
    sentences = re.split(r'(?<=[.!?])\s+', response)
    filtered_sentences = []
    diagnosis_found = False

    for sentence in sentences:
        sentence_lower = sentence.lower()
        if any(phrase in sentence_lower for phrase in DIAGNOSIS_PHRASES):
            diagnosis_found = True
        else:
            filtered_sentences.append(sentence)

    if diagnosis_found:
        filtered_sentences.append(PROFESSIONAL_HELP_SUGGESTION)

    response = " ".join(filtered_sentences)

    # Rule 2 — Low Confidence Handler
    if emotion_score < 0.5 or category_score < 0.5:
        response = response.rstrip() + " " + LOW_CONFIDENCE_FOLLOWUP

    # Rule 3 — Response Too Short (less than 20 words)
    if len(response.split()) < 20:
        response = response.rstrip()
        if not response.endswith("?"):
            response += " Can you share more about what you're going through?"

    # Rule 4 — Always Safe Closing for high-confidence categories
    if category_score > 0.85:
        if SAFE_CLOSING.lower() not in response.lower():
            response = response.rstrip() + " " + SAFE_CLOSING

    return response
