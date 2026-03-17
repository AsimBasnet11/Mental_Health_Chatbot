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

# Medication / drug names the LLM should never recommend
_MEDICATION_PATTERN = re.compile(
    r"\b(take|prescribe|recommend|try|suggest)\b.{0,30}"
    r"\b(xanax|prozac|zoloft|lexapro|valium|adderall|ritalin"
    r"|sertraline|fluoxetine|citalopram|escitalopram|alprazolam"
    r"|diazepam|lorazepam|clonazepam|bupropion|venlafaxine"
    r"|duloxetine|lithium|quetiapine|aripiprazole|medication|meds|pills)\b",
    re.IGNORECASE,
)

# Hallucination / role-break phrases to strip
_HALLUCINATION_PHRASES = [
    "as an ai", "as a language model", "i'm just a chatbot",
    "i cannot provide medical", "i'm not a real therapist",
    "as an artificial intelligence",
]

PROFESSIONAL_HELP_SUGGESTION = (
    "I'd encourage you to speak with a licensed mental health professional "
    "who can provide a proper assessment and personalized support."
)

LOW_CONFIDENCE_FOLLOWUP = (
    "I want to make sure I understand you correctly. "
    "Could you tell me more about how you are feeling?"
)

# ✅ UPDATED: Removed from every message — shown once by frontend after 3rd message
SAFE_CLOSING = ""

# ✅ UPDATED: Nepal-specific crisis resources
CRISIS_RESOURCES = (
    "If you're in immediate danger, please reach out for help — you are not alone. "
    "Nepal Mental Health Helpline: 1166 (Transcultural Psychosocial Organization Nepal). "
    "Saathi Helpline: 1145. "
    "Or visit your nearest hospital emergency department immediately."
)

# Hard cap so the bot doesn't ramble
_MAX_RESPONSE_WORDS = 150


def apply_safety_guardrails(response, emotion_score=1.0, category_score=1.0,
                            category=None):
    """Apply safety rules to the LLM response.

    Args:
        response: The raw LLM response text.
        emotion_score: Emotion detection confidence (0.0 - 1.0).
        category_score: Mental health classification confidence (0.0 - 1.0).
        category: Mental health classification label (e.g. 'Suicidal').

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

    # Rule 2 — No Medication Recommendations
    if _MEDICATION_PATTERN.search(response):
        response = _MEDICATION_PATTERN.sub(
            "speaking with a doctor about treatment options", response
        )

    # Rule 3 — Strip hallucination / role-break sentences
    for phrase in _HALLUCINATION_PHRASES:
        if phrase in response.lower():
            parts = re.split(r'(?<=[.!?])\s+', response)
            parts = [s for s in parts if phrase not in s.lower()]
            response = " ".join(parts)

    # Rule 4 — Low Confidence Handler
    if (emotion_score < 0.5 or category_score < 0.5) and len(response.split()) < 40:
        response = response.rstrip() + " " + LOW_CONFIDENCE_FOLLOWUP

    # Rule 5 — Response Too Short (less than 20 words)
    if len(response.split()) < 10:
        response = response.rstrip()
        if not response.endswith("?"):
            response += " Can you share more about what you're going through?"

    # Rule 6 — Response Too Long — trim to _MAX_RESPONSE_WORDS
    words = response.split()
    if len(words) > _MAX_RESPONSE_WORDS:
        response = " ".join(words[:_MAX_RESPONSE_WORDS]).rstrip(".,;: ") + "."

    # Rule 7 — Safe Closing (disabled — frontend handles this after 3rd message)
    # if category_score > 0.85:
    #     if SAFE_CLOSING.lower() not in response.lower():
    #         response = response.rstrip() + " " + SAFE_CLOSING

    # Rule 8 — Inject Nepal crisis resources for Suicidal category
    if category and category.lower() == "suicidal" and category_score >= 0.5:
        if "1166" not in response:
            response = response.rstrip() + " " + CRISIS_RESOURCES

    return response