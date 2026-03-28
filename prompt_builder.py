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

# ── System prompt — Updated for warm and conversational tone ──
SYSTEM_PROMPT = (
    "You are Aria, a warm, empathetic, and highly conversational mental health companion.\n"
    "When responding, follow these rules:\n"
    "1. Speak like a close, caring friend. Use very casual, brief, and warm language.\n"
    "2. NEVER use robotic textbook phrases like 'I am truly sorry to hear that you are feeling this way', 'It is important to remember', or 'There are people who care'.\n"
    "3. Keep your response to 2-3 short sentences MAXIMUM.\n"
    "4. ALWAYS end with a gentle, open-ended follow-up question.\n"
    "5. Highly vary your vocabulary and phrasing. Avoid repetitive platitudes and ensure each response feels uniquely personal.\n"
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
            "[Note: The user is in serious distress. "
            "Respond simply, concisely, and informally like a deeply concerned friend. "
            "Do NOT give formal textbook advice. "
            "If risk feels immediate, mention Nepal Mental Health Helpline 1166 "
            "or Saathi 1145.]\n\n"
        )
    elif category in _HIGH_RISK_CATEGORIES and category_score >= 0.70:
        crisis_prefix = (
            "[Note: The user may be struggling. Be gentle, informal, and concise.]\n\n"
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