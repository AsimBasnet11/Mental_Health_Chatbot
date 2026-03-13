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
    "Could you tell me a bit more about what you're feeling?"
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

    # Rule 2 — Low Confidence: ask for clarification when models are unsure
    if emotion_score < 0.3 and category_score < 0.3:
        response = response.rstrip() + " " + LOW_CONFIDENCE_FOLLOWUP

    return response
