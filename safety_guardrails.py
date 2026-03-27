"""
Safety Guardrails — rebuilt for Aria SFT+DPO
Post-processing rules applied AFTER the LLM generates a response.

Simplified after fine-tuning:
- Model already knows good style — fewer aggressive rules
- Focus on safety-critical blocks only
- List handling preserved
- Cliche remover narrowed

Changes:
- Removed unused emotion_score parameter
- Added crisis_level parameter — resources injected at crisis_level >= 2
  even when category score is below threshold
- Rule 6 (strip hallucinated helplines) always runs before Rule 7 (inject
  correct resources) — correct order, one pass, no double-injection risk
"""

import re


def _ensure_complete_sentence(text):
    """Trim to last complete sentence if response is cut mid-sentence."""
    text = text.strip()
    if not text:
        return text
    if text[-1] in ('.', '!', '?'):
        return text
    match = re.search(r'^(.*[.!?])', text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text


# ── Safety patterns ────────────────────────────────────────────
_HARMFUL_OUTPUT_PATTERNS = re.compile(
    r"\b(here are (some )?(methods|ways) to (die|kill|hurt|harm|overdose|self.harm)"
    r"|step(s)? (to|for) (suicide|self.harm|killing yourself)"
    r"|you (should|could|can) (hurt|harm|kill|end) (yourself|your life)"
    r"|it('s| is) (okay|fine|understandable) to (hurt|harm|kill) yourself"
    r"|suicide (can be|is sometimes|might be) (the best|a valid|an option))\b",
    re.IGNORECASE,
)

_HARMFUL_VALIDATION_PATTERNS = re.compile(
    r"\b(you('re| are) right (that|,) (life|everything) is (pointless|useless|hopeless)"
    r"|yes,? (life|it) (is|can be) (pointless|useless)"
    r"|i agree (that|,) you (deserve to suffer|should disappear)"
    r"|you do deserve to suffer"
    r"|maybe (suicide|ending it) (is|could be) the (best|right) (option|choice))\b",
    re.IGNORECASE,
)

_MEDICATION_PATTERN = re.compile(
    r"\b(take|prescribe|recommend|try|suggest)\b.{0,30}"
    r"\b(xanax|prozac|zoloft|lexapro|valium|adderall|ritalin"
    r"|sertraline|fluoxetine|citalopram|escitalopram|alprazolam"
    r"|diazepam|lorazepam|clonazepam|bupropion|venlafaxine"
    r"|duloxetine|lithium|quetiapine|aripiprazole)\b",
    re.IGNORECASE,
)

_HALLUCINATION_PHRASES = [
    "as an ai", "as a language model", "i'm just a chatbot",
    "i cannot provide medical", "i'm not a real therapist",
    "as an artificial intelligence",
]

_DIAGNOSIS_PHRASES = [
    "you have", "you are diagnosed", "you suffer from",
    "you are suffering from", "your diagnosis is",
    "i diagnose you", "you clearly have",
]

# Cliche sentences to remove — kept narrow after fine-tuning
_CLICHE_RE = re.compile(
    r"[^.!?]*\b("
    r"it('s| is) (important|essential|crucial|vital) to remember"
    r"|it('s| is) (important|essential|crucial|vital) that you"
    r"|everyone (experiences|goes through|faces) (challenges|setbacks|failures|this)"
    r"|failure doesn't define"
    r"|doesn't define your worth"
    r"|range of emotions"
    r"|one suggestion (i have )?(is|would be)"
    r"|one (thing|suggestion|tip|step) (i would|i'd) (suggest|recommend)"
    r"|here are (some |a few )?(steps|ways|things|areas|tips)"
    r")\b[^.!?]*[.!?]",
    re.IGNORECASE
)

# Strips colon-labeled soft list sentences: "Reach out for support: Consider..."
# or "Self-care - Take some time..."
_SOFT_LIST_RE = re.compile(
    r'[^.!?]*\b[A-Za-z][^.!?]{0,40}[-:]\s+[A-Z][^.!?]*[.!?]?',
)

_HELPLINE_SENTENCE_RE = re.compile(
    r'[^.!?]*\b(1166|1145|helpline|hotline|crisis line|saathi|tpo nepal'
    r'|mental health helpline|emergency department)[^.!?]*[.!?]?',
    re.IGNORECASE
)

CRISIS_RESOURCES = (
    "If you're in immediate danger, please reach out for help. You are not alone. "
    "Nepal Mental Health Helpline: 1166 (TPO Nepal). "
    "Saathi Helpline: 1145. "
    "Or visit your nearest hospital emergency department immediately."
)

HARMFUL_OUTPUT_FALLBACK = (
    "I'm here to support you through this difficult time. "
    "What you're feeling is real and valid, and you deserve proper care. "
    "Would you be open to talking about what's been making things so hard lately?"
)

PROFESSIONAL_HELP_SUGGESTION = (
    "I'd encourage you to speak with a licensed mental health professional "
    "who can provide a proper assessment and personalized support."
)


def apply_safety_guardrails(response, category_score=1.0,
                            category=None, requested_list_count=None,
                            crisis_level=0):

    # Strip user state tag if model echoed it
    response = re.sub(r'\[user_state:[^\]]*\]\s*', '', response).strip()
    # Strip internal notes if model echoed them
    response = re.sub(r'\[This person[^\]]*\]\s*', '', response).strip()
    response = re.sub(r'\[Your last response[^\]]*\]\s*', '', response).strip()

    # Rule 0 — Block harmful outputs
    if _HARMFUL_OUTPUT_PATTERNS.search(response):
        response = HARMFUL_OUTPUT_FALLBACK
        if category and category.lower() == "suicidal":
            response += " " + CRISIS_RESOURCES
        return _ensure_complete_sentence(response)

    # Rule 0b — Block harmful validation
    if _HARMFUL_VALIDATION_PATTERNS.search(response):
        response = (
            "I hear that you're in a lot of pain, and your feelings are real. "
            "But I'm not able to agree with thoughts that could hurt you — "
            "because you deserve support and care, not confirmation of those feelings. "
            "Can you tell me more about what's been making things feel this way?"
        )
        return _ensure_complete_sentence(response)

    # Rule 0c — Strip cliche/clinical sentences (narrow)
    cleaned = _CLICHE_RE.sub('', response).strip()
    cleaned = _SOFT_LIST_RE.sub('', cleaned).strip()
    if len(cleaned.split()) >= 8:
        response = cleaned
    response = re.sub(r'  +', ' ', response).strip()

    # Rule 1 — No diagnosis
    sentences = re.split(r'(?<=[.!?])\s+', response)
    filtered = []
    diagnosis_found = False
    for sentence in sentences:
        if any(phrase in sentence.lower() for phrase in _DIAGNOSIS_PHRASES):
            diagnosis_found = True
        else:
            filtered.append(sentence)

    is_list_response = bool(re.search(r'(^|\n|\s)\s*\d+[.)]\s+\w', response))
    if diagnosis_found and not is_list_response:
        filtered.append(PROFESSIONAL_HELP_SUGGESTION)
    response = " ".join(filtered)

    # Rule 2 — No medication recommendations
    if _MEDICATION_PATTERN.search(response):
        response = _MEDICATION_PATTERN.sub(
            "speaking with a doctor about treatment options", response
        )

    # Rule 3 — Strip hallucination phrases
    for phrase in _HALLUCINATION_PHRASES:
        if phrase in response.lower():
            parts = re.split(r'(?<=[.!?])\s+', response)
            parts = [s for s in parts if phrase not in s.lower()]
            response = " ".join(parts)

    # Rule 4 — Response too short
    if len(response.split()) < 10:
        response = response.rstrip()
        if not response.endswith("?"):
            response += " Can you share more about what you're going through?"

    # Rule 5 — Cap at 4 sentences, no word limit
    # Model tends to loop and repeat — 4 sentences keeps it focused
    sentences = re.split(r'(?<=[.!?])\s+', response.strip())
    sentences = [s for s in sentences if s.strip()]
    # Drop any sentence that is just a numbered list opener cut off mid-way
    # e.g. "Here are some suggestions: 1." or "Here are some tips:"
    sentences = [
        s for s in sentences
        if not re.search(r'(:\s*\d+\.?\s*$|^\d+\.\s*$|here are (some|a few)[^.!?]*:\s*$)', s.strip(), re.IGNORECASE)
    ]
    if len(sentences) > 3:
        sentences = sentences[:3]
    response = ' '.join(sentences)
    response = _ensure_complete_sentence(response)

    # Rule 6 — Strip any helpline sentences the model hallucinated
    # always runs before Rule 7 so we never accidentally strip the correct ones
    response = _HELPLINE_SENTENCE_RE.sub('', response).strip()
    response = re.sub(r'  +', ' ', response).strip()

    # Rule 7 — Inject correct Nepal crisis resources when needed:
    # - suicidal category with high confidence, OR
    # - crisis_level >= 2 (moderate/severe) regardless of category score
    needs_resources = (
        (category and category.lower() == "suicidal" and category_score >= 0.85)
        or crisis_level >= 2
    )
    if needs_resources and "1166" not in response:
        response = response.rstrip() + " " + CRISIS_RESOURCES

    return _ensure_complete_sentence(response)