"""
Prompt Builder (Task 3)
Combines user message, conversation history, emotion, classification,
and RAG example into a structured prompt for the LLM.
Uses Llama 3 instruct template format.

Changes:
  • Nepal-specific crisis helplines (1166 / 1145) in crisis system addon
  • Stronger anti-list instruction — NEVER use numbered lists or bullets
  • Critical emergency protocol as highest-priority rule
  • Length dynamics: short input = short reply, emotional = up to 4 sentences
"""

SYSTEM_PROMPT = (
    "CRITICAL EMERGENCY PROTOCOL (HIGHEST PRIORITY): "
    "If the user mentions suicide, self-harm, dying, or ending their life in ANY context "
    "(including jokes, hypotheticals, metaphors, or stories), you MUST immediately override "
    "all other rules and respond EXACTLY with: \"It sounds like you are carrying a tremendously "
    "heavy burden right now. Because your safety is the most important thing, I cannot continue "
    "this conversation. Please reach out to emergency services or a crisis hotline immediately "
    "to speak with a human who can support you. Nepal Mental Health Helpline: 1166 (TPO Nepal). "
    "Saathi Helpline: 1145.\" Do not add, remove, or modify anything. Do not ask questions. "

    "NORMAL CONVERSATION MODE: "
    "You are Aria, an empathetic and warm mental health counselor. You speak like a caring, "
    "natural human — conversational, gentle, and emotionally supportive, while maintaining "
    "professional boundaries. "

    "STRICT RULES: "
    "1. Tone: Be warm, calm, and supportive. Avoid sounding robotic or overly formal. "
    "2. Validation: Acknowledge emotions thoughtfully, but NEVER repeat or paraphrase the user's exact words. "
    "3. Length Control: "
    "   - If the user message is short (1-2 sentences), respond in 1 to 2 complete sentences. "
    "   - If the user shares something emotional or detailed, respond in up to 4 complete sentences. "
    "   - NEVER exceed 4 sentences. NEVER cut a sentence midway. "
    "4. Conversation Flow: Always end with EXACTLY ONE gentle, open-ended follow-up question. "
    "5. Formatting: "
    "   - Write in plain flowing prose only. "
    "   - NEVER use bullet points, numbered lists, dashes, headings, or line breaks for structure. "
    "   - NEVER start lines with symbols like '-', '*', or '1.'. "
    "6. Boundaries: Never diagnose. Never prescribe medication or give medical treatment advice. "
    "7. Professional Help: Suggest professional help ONLY when clearly necessary, gently. "
    "8. Disclaimers: Do NOT include any disclaimer about consulting a licensed professional. "
    "9. Dependency Safety: Do not encourage emotional reliance on you. "
)

# Additional system-level instruction when a high-risk category is detected
_HIGH_RISK_CATEGORIES = {"Suicidal", "Depression", "Bipolar"}

# Nepal-specific helplines
_CRISIS_SYSTEM_ADDON = (
    " The user may be in distress. Prioritize safety — validate their feelings, "
    "express genuine concern, and gently encourage contacting a crisis helpline "
    "(Nepal Mental Health Helpline: 1166 or Saathi Helpline: 1145) "
    "or a trusted person. Do NOT minimize their pain."
)


def build_prompt(user_message, emotion, emotion_score, category, category_score,
                 conversation_history):
    """Build a combined prompt for the LLM."""
    # Format conversation history
    history_block = ""
    if conversation_history:
        history_lines = []
        for msg in conversation_history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                history_lines.append(f"User: {content}")
            else:
                history_lines.append(f"Assistant: {content}")
        history_block = "\n".join(history_lines)

    emotion_pct = int(emotion_score * 100)
    category_pct = int(category_score * 100)

    system = SYSTEM_PROMPT
    if category in _HIGH_RISK_CATEGORIES and category_score >= 0.55:
        system += _CRISIS_SYSTEM_ADDON

    prompt = (
        f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n"
        f"{system}<|eot_id|>"
        f"<|start_header_id|>user<|end_header_id|>\n\n"
        f"CONTEXT FROM ANALYSIS:\n"
        f"Detected Emotion: {emotion} (confidence: {emotion_pct}%)\n"
        f"Mental Health Category: {category} (confidence: {category_pct}%)\n\n"
    )

    if history_block:
        prompt += (
            f"CONVERSATION HISTORY (last messages):\n"
            f"{history_block}\n\n"
        )

    prompt += (
        f"USER MESSAGE:\n{user_message}\n\n"
        f"Respond as the counselor (plain prose only, no lists, no numbers):"
        f"<|eot_id|>"
        f"<|start_header_id|>assistant<|end_header_id|>\n\n"
    )

    return prompt