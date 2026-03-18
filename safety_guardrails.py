"""
Safety Guardrails (Task 6)
Post-processing rules applied AFTER the LLM generates a response.
Ensures output is safe, ethical, and appropriate for mental health context.

Changes:
  • Nepal-specific crisis resources (1166 / 1145) throughout
  • Rule 0: Strip ALL list formats (inline numbered, newline numbered, bullets)
  • Wrong-region helpline replacement (988 → Nepal numbers)
"""

import re

# Phrases that indicate the LLM is attempting to diagnose
DIAGNOSIS_PHRASES = [
    "you have", "you are diagnosed", "you suffer from",
    "you are suffering from", "your diagnosis is",
    "i diagnose you", "you clearly have",
    "sounds like you may have", "sounds like you have",
    "it seems like you have", "it seems you have",
    "it sounds like you have", "you might have",
    "you could have", "you likely have"
]

# Diagnosis REQUEST phrases — user asking for diagnosis
# These should be redirected to professional help, not diagnosed
_DIAGNOSIS_REQUEST_RE = re.compile(
    r'\b(diagnose me|do i have|can you diagnose|what disorder do i have'
    r'|do i have (depression|anxiety|bipolar|adhd|add|ocd|ptsd|bpd)'
    r'|am i (depressed|bipolar|schizophrenic|autistic)'
    r'|is it (depression|anxiety|bipolar)|what is wrong with me'
    r'|i think i have (depression|anxiety|bipolar|adhd|add|ocd|ptsd|bpd))\b',
    re.IGNORECASE
)

DIAGNOSIS_REDIRECT = (
    "I can hear that you're trying to understand what you're going through, and that takes courage. "
    "I'm not able to diagnose conditions — that requires a licensed professional who can properly assess you. "
    "What I can do is listen and support you. Would you like to talk more about how you've been feeling?"
)

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
    "i am not a licensed", "i'm not a licensed",
    "i am not a therapist", "i'm not a therapist",
    "i am not a mental health professional",
    "please note that i am not", "please remember i am not",
    "i cannot replace", "i am not able to replace",
]

# Wrong region helpline numbers to replace
_WRONG_REGION_PATTERN = re.compile(
    r"\b(988|1-800-273-8255|1800\s*273\s*8255)\b", re.IGNORECASE
)

# Detects inline or newline numbered list: "1. " "2. " "1) " etc.
_HAS_NUMBERED_LIST_RE = re.compile(r"(?<!\d)\b\d+[.)]\s+\w", re.MULTILINE)
_SPLIT_NUMBERED_RE    = re.compile(r"\s*\d+[.)]\s+", re.MULTILINE)

# Detects bullet lists: "- " "* " "• " at start of line
_BULLET_RE = re.compile(r"(?:^|\n)\s*[-*•]\s+", re.MULTILINE)

PROFESSIONAL_HELP_SUGGESTION = (
    "I'd encourage you to speak with a licensed mental health professional "
    "who can provide a proper assessment and personalized support."
)

LOW_CONFIDENCE_FOLLOWUP = (
    "I want to make sure I understand you correctly. "
    "Could you tell me more about how you are feeling?"
)

# Nepal-specific crisis resources
CRISIS_RESOURCES = (
    "If you're in immediate danger, please reach out — you are not alone. "
    "Nepal Mental Health Helpline: 1166 (TPO Nepal, free & confidential). "
    "Saathi Helpline: 1145. "
    "Or visit your nearest hospital emergency department immediately."
)

# Hard cap — raised to allow complete responses without cutting mid-sentence
_MAX_RESPONSE_WORDS = 120


def _strip_lists(text: str) -> str:
    """Convert ANY list format (inline numbered, newline numbered, bullets)
    into plain prose. Keeps up to 3 items. Drops intro fluff like
    'Here are some suggestions:'.
    """
    def _join(parts):
        parts = [p.strip() for p in parts if p.strip()]
        parts = parts[:3]
        out = []
        for p in parts:
            p = p.rstrip(".:,")
            if p and p[-1] not in ".!?":
                p += "."
            out.append(p)
        return " ".join(out)

    # Bullet list (newline-based)
    if _BULLET_RE.search(text):
        items = _BULLET_RE.split(text)
        return _join(items)

    # Numbered list (inline or newline)
    if _HAS_NUMBERED_LIST_RE.search(text):
        items = _SPLIT_NUMBERED_RE.split(text)
        # Drop preamble that ends with ':' (e.g. "Here are some suggestions:")
        if items and items[0].strip().endswith(":"):
            items = items[1:]
        return _join(items)

    return text  # no list found — return unchanged


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
    # Rule 0 — Intercept diagnosis requests — redirect to professional help
    # Applied to both user message context and LLM response
    if _DIAGNOSIS_REQUEST_RE.search(response):
        # Strip any attempted diagnosis from the response
        sentences = re.split(r'(?<=[.!?])\s+', response)
        clean = [s for s in sentences if not any(
            p in s.lower() for p in ["you have", "you are diagnosed", "you suffer", "you clearly"]
        )]
        response = " ".join(clean) if clean else DIAGNOSIS_REDIRECT

    # Rule 0a — Strip numbered/bulleted lists → convert to plain prose
    response = _strip_lists(response)

    # Rule 0b — Remove repeated sentences (LLM sometimes loops)
    seen = []
    for sent in re.split(r'(?<=[.!?])\s+', response):
        if sent.strip().lower() not in [s.lower() for s in seen]:
            seen.append(sent.strip())
    response = " ".join(seen)

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

    # Rule 4 — Replace wrong-region helplines with Nepal numbers
    if _WRONG_REGION_PATTERN.search(response):
        response = _WRONG_REGION_PATTERN.sub("1166 (Nepal TPO) or 1145 (Saathi)", response)

    # Rule 5 — Low Confidence Handler
    if (emotion_score < 0.5 or category_score < 0.5) and len(response.split()) < 40:
        response = response.rstrip() + " " + LOW_CONFIDENCE_FOLLOWUP

    # Rule 6 — Response Too Short (less than 10 words)
    if len(response.split()) < 10:
        response = response.rstrip()
        if not response.endswith("?"):
            response += " Can you share more about what you're going through?"

    # Rule 7 — Response Too Long — trim at complete sentence boundary
    words = response.split()
    if len(words) > _MAX_RESPONSE_WORDS:
        sentences = re.split(r'(?<=[.!?])\s+', response)
        trimmed = ""
        for sentence in sentences:
            candidate = (trimmed + " " + sentence).strip()
            if len(candidate.split()) <= _MAX_RESPONSE_WORDS:
                trimmed = candidate
            else:
                break  # always ends on a complete sentence
        response = trimmed if trimmed else sentences[0]

    # Rule 8 — Inject Nepal crisis resources for Suicidal category
    if category and category.lower() == "suicidal" and category_score >= 0.5:
        if "1166" not in response and "1145" not in response:
            response = response.rstrip() + " " + CRISIS_RESOURCES

    return response