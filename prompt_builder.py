"""
Prompt Builder — MentalChat16K counselor model
Matches the exact training format of ShenLab/MentalChat16K.

Training format:
  instruction: fixed one-line system prompt (same for all 16K rows)
  input:       patient description
  output:      counselor response (comprehensive, CBT-informed)

DO NOT inject:
  - 3-sentence structure rules (that was Aria SFT/DPO — wrong model)
  - few-shot examples in the user turn
  - memory notes or style instructions

Only inject:
  - crisis note at high confidence (suicidal category) — keeps it safe
  - conversation history in standard user/assistant turns

NOT connected to pipeline.py — ready to plug in when needed.
To connect, replace chat_history build in pipeline.py Step 5 with:
    built = build_prompt(user_message, emotion, emotion_score,
                         category, category_score, history_for_prompt)
    and pass built to llm_responder accordingly.
"""

import re

# ── System prompt — exact string from MentalChat16K training data ──
SYSTEM_PROMPT = (
    "You are a helpful mental health counselling assistant, please answer "
    "the mental health questions based on the patient's description. "
    "The assistant gives helpful, comprehensive, and appropriate answers "
    "to the user's questions."
)

# ── High risk flag ─────────────────────────────────────────────
_HIGH_RISK_CATEGORIES = {"Suicidal", "Depression", "Bipolar"}


def build_prompt(user_message, emotion, emotion_score, category, category_score,
                 conversation_history):
    """
    Build prompt matching MentalChat16K training format.

    Returns {"system": str, "messages": list}
    where messages is a list of {"role": ..., "content": ...} dicts
    ready to pass to llm_responder._build_llama3_prompt().
    """

    # Crisis note — only injected at high confidence, prepended to user message
    crisis_prefix = ""
    if category == "Suicidal" and category_score >= 0.80:
        crisis_prefix = (
            "[Note: This person may be in serious distress. "
            "Be especially gentle and present. "
            "If risk feels immediate, mention Nepal Mental Health Helpline 1166 "
            "or Saathi 1145.]\n\n"
        )
    elif category in _HIGH_RISK_CATEGORIES and category_score >= 0.70:
        crisis_prefix = (
            "[Note: This person may be struggling. Be gentle and present.]\n\n"
        )

    # Build conversation history (last 6 turns, current user message excluded)
    messages = []

    if conversation_history:
        recent = conversation_history[-6:]
        # Drop last user message — appended fresh below
        for i in range(len(recent) - 1, -1, -1):
            if recent[i].get("role") == "user":
                recent = recent[:i] + recent[i + 1:]
                break
        for msg in recent:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })

    # Append current user message (with optional crisis prefix)
    messages.append({
        "role": "user",
        "content": crisis_prefix + user_message
    })

    return {"system": SYSTEM_PROMPT, "messages": messages}