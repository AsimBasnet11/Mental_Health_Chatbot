"""
Safety Guardrails — Enhanced
Post-processing rules applied AFTER the LLM generates a response.
"""


import re

def _ensure_complete_sentence(text):
    """If text ends mid-sentence, trim back to the last complete sentence."""
    text = text.strip()
    if not text:
        return text
    # Already ends cleanly
    if text[-1] in ('.', '!', '?'):
        return text
    # Find the last sentence that ends with punctuation
    match = re.search(r'^(.*[.!?])', text, re.DOTALL)
    if match:
        return match.group(1).strip()
    # No complete sentence found — return as is
    return text

DIAGNOSIS_PHRASES = [
    "you have", "you are diagnosed", "you suffer from",
    "you are suffering from", "your diagnosis is",
    "i diagnose you", "you clearly have"
]

_MEDICATION_PATTERN = re.compile(
    r"\b(take|prescribe|recommend|try|suggest)\b.{0,30}"
    r"\b(xanax|prozac|zoloft|lexapro|valium|adderall|ritalin"
    r"|sertraline|fluoxetine|citalopram|escitalopram|alprazolam"
    r"|diazepam|lorazepam|clonazepam|bupropion|venlafaxine"
    r"|duloxetine|lithium|quetiapine|aripiprazole|medication|meds|pills)\b",
    re.IGNORECASE,
)

_HALLUCINATION_PHRASES = [
    "as an ai", "as a language model", "i'm just a chatbot",
    "i cannot provide medical", "i'm not a real therapist",
    "as an artificial intelligence",
]

# Harmful phrases the LLM should never output
_HARMFUL_OUTPUT_PATTERNS = re.compile(
    r"\b(here are (some )?(methods|ways) to (die|kill|hurt|harm|overdose|self.harm)"
    r"|step(s)? (to|for) (suicide|self.harm|killing yourself)"
    r"|you (should|could|can) (hurt|harm|kill|end) (yourself|your life)"
    r"|it('s| is) (okay|fine|understandable) to (hurt|harm|kill) yourself"
    r"|suicide (can be|is sometimes|might be) (the best|a valid|an option))\b",
    re.IGNORECASE,
)

# Harmful validation — bot agreeing with harmful beliefs
_HARMFUL_VALIDATION_PATTERNS = re.compile(
    r"\b(you('re| are) right (that|,) (life|everything) is (pointless|useless|hopeless)"
    r"|yes,? (life|it) (is|can be) (pointless|useless)"
    r"|i agree (that|,) you (deserve to suffer|should disappear)"
    r"|you do deserve to suffer"
    r"|maybe (suicide|ending it) (is|could be) the (best|right) (option|choice))\b",
    re.IGNORECASE,
)

PROFESSIONAL_HELP_SUGGESTION = (
    "I'd encourage you to speak with a licensed mental health professional "
    "who can provide a proper assessment and personalized support."
)

LOW_CONFIDENCE_FOLLOWUP = (
    "I want to make sure I understand you correctly. "
    "Could you tell me more about how you are feeling?"
)

SAFE_CLOSING = ""

CRISIS_RESOURCES = (
    "If you're in immediate danger, please reach out for help — you are not alone. "
    "Nepal Mental Health Helpline: 1166 (TPO Nepal). "
    "Saathi Helpline: 1145. "
    "Or visit your nearest hospital emergency department immediately."
)

HARMFUL_OUTPUT_FALLBACK = (
    "I'm here to support you through this difficult time. "
    "What you're feeling is real and valid, and you deserve proper care. "
    "Would you be open to talking about what's been making things so hard lately?"
)

_MAX_RESPONSE_WORDS = 150


def apply_safety_guardrails(response, emotion_score=1.0, category_score=1.0,
                            category=None):
    # Rule 0 — Block harmful LLM outputs entirely
    if _HARMFUL_OUTPUT_PATTERNS.search(response):
        log_msg = response[:80]
        response = HARMFUL_OUTPUT_FALLBACK
        if category and category.lower() == "suicidal":
            response += " " + CRISIS_RESOURCES
        # Final check — never return a cut mid-sentence response
    response = _ensure_complete_sentence(response)
    return response

    # Rule 0b — Block harmful validation outputs
    if _HARMFUL_VALIDATION_PATTERNS.search(response):
        response = (
            "I hear that you're in a lot of pain, and your feelings are real. "
            "But I'm not able to agree with thoughts that could hurt you — "
            "because you deserve support and care, not confirmation of those feelings. "
            "Can you tell me more about what's been making things feel this way?"
        )
        # Final check — never return a cut mid-sentence response
    response = _ensure_complete_sentence(response)
    return response

    # Rule 1 — No Diagnosis
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

    # Rule 5 — Response Too Short
    if len(response.split()) < 10:
        response = response.rstrip()
        if not response.endswith("?"):
            response += " Can you share more about what you're going through?"

    # Rule 6 — Response Too Long — trim at sentence boundary
    words = response.split()
    if len(words) > _MAX_RESPONSE_WORDS:
        sentences = re.split(r'(?<=[.!?])\s+', response)
        trimmed = ""
        for sentence in sentences:
            if len((trimmed + " " + sentence).split()) <= _MAX_RESPONSE_WORDS:
                trimmed = (trimmed + " " + sentence).strip()
            else:
                break
        response = trimmed if trimmed else sentences[0]

    # Rule 7 — Inject Nepal crisis resources for Suicidal category
    if category and category.lower() == "suicidal" and category_score >= 0.5:
        if "1166" not in response:
            response = response.rstrip() + " " + CRISIS_RESOURCES

    # Final check — never return a cut mid-sentence response
    response = _ensure_complete_sentence(response)
    return response