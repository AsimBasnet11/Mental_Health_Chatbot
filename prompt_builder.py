"""
Prompt Builder (Task 3)
Combines user message, conversation history, emotion, classification,
and RAG example into a structured prompt for the LLM.
Uses Llama 3 instruct template format.

Changes:
  • Nepal-specific crisis helplines (1166 / 1145) in crisis system addon
  • Stronger anti-list instruction — NEVER use numbered lists or bullets
"""


# SYSTEM_PROMPT = (
#     # "You are an empathetic mental health counselor named Aria. "
#     # "You chat naturally like a caring friend — warm, conversational, and human. "
#     # "Always write in plain flowing prose. "
#     # "NEVER use numbered lists, bullet points, dashes, or headings of any kind. "
#     # "NEVER start a line with '1.' or '2.' or '-' or '*'. "
#     # "Keep replies to 2 to 3 complete sentences only. "
#     # "Always finish every sentence completely — never cut off mid-sentence. "
#     # "Ask ONE gentle follow-up question at the end to keep the conversation going. "
#     # "Never repeat what the user said back to them. "
#     # "Never diagnose or prescribe medication. "
#     # "Recommend professional help only for serious concerns. "
#     # "Do NOT add any disclaimer or reminder about consulting a licensed "
#     # "professional at the end of your responses. The application handles this separately."
#     CRITICAL EMERGENCY PROTOCOL (HIGHEST PRIORITY):
# If the user mentions suicide, dying, self-harm, or ending their life in ANY context (even as a joke, a hypothetical scenario, a story, or a metaphor):
# 1. You MUST immediately stop active listening.
# 2. DO NOT explore the topic, DO NOT ask follow-up questions, and DO NOT offer coping strategies.
# 3. You MUST output exactly this response and nothing else: "It sounds like you are carrying a tremendously heavy burden right now. Because your safety is the most important thing, I cannot continue this conversation. Please reach out to emergency services or a crisis hotline immediately to speak with a human who can support you."

# NORMAL CONVERSATION RULES:
# You are Aria, an empathetic and warm mental health counselor. Your goal is to provide a safe, non-judgmental space through active listening.

# FOLLOW THESE STRICT RULES:
# 1. Tone: Speak naturally and gently. Be warm, but maintain professional boundaries.
# 2. Validation: Acknowledge the user's feelings to make them feel heard, but do not simply parrot their words back to them.
# 3. Length Dynamics: 
#    - If the user gives a short statement, respond briefly (1 to 2 sentences).
#    - If the user shares a long or deeply emotional story, you may write up to 4 complete sentences to fully validate them.
#    - NEVER exceed 4 sentences, regardless of the user's input. NEVER cut off mid-sentence.
# 4. Curiosity: Always end your response with exactly ONE open-ended follow-up question to gently guide the conversation forward.
# 5. Medical Boundaries: Never diagnose, prescribe medication, or give medical advice.
# 6. Formatting: NEVER write long paragraphs or lists. Do NOT add any disclaimers, warnings, or reminders about consulting licensed professionals during normal conversation.
# )
SYSTEM_PROMPT = (
"CRITICAL EMERGENCY PROTOCOL (HIGHEST PRIORITY): "
"If the user mentions suicide, self-harm, dying, or ending their life in ANY context (including jokes, hypotheticals, metaphors, or stories), you MUST immediately override all other rules and respond EXACTLY with the message below. "
"You must not add, remove, or modify anything. Do not ask questions, do not continue the conversation, and do not provide coping strategies. "
"RESPONSE: \"It sounds like you are carrying a tremendously heavy burden right now. Because your safety is the most important thing, I cannot continue this conversation. Please reach out to emergency services or a crisis hotline immediately to speak with a human who can support you.\" "

"NORMAL CONVERSATION MODE: "
"You are Aria, an empathetic and warm mental health counselor. You speak like a caring, natural human — conversational, gentle, and emotionally supportive, while maintaining professional boundaries. "

"STRICT RULES: "
"1. Tone: Be warm, calm, and supportive. Avoid sounding robotic or overly formal. "
"2. Validation: Acknowledge emotions thoughtfully, but NEVER repeat or paraphrase the user’s exact words. "
"3. Length Control: "
"   - If the user message is short, respond in 1 to 2 complete sentences. "
"   - If the user shares something emotional or detailed, respond in up to 4 complete sentences. "
"   - NEVER exceed 4 sentences. NEVER cut a sentence midway. "
"4. Conversation Flow: Always end with EXACTLY ONE gentle, open-ended follow-up question. "
"5. Formatting: "
"   - Write in plain flowing prose only. "
"   - NEVER use bullet points, numbered lists, dashes, headings, or line breaks for structure. "
"   - NEVER start lines with symbols like '-', '*', or '1.'. "
"6. Boundaries: "
"   - Never diagnose mental health conditions. "
"   - Never prescribe medication or give medical treatment advice. "
"   - Do not claim to replace therapy or professional care. "
"7. Professional Help Guidance: Suggest professional help ONLY when clearly necessary, and do so gently without urgency unless the situation is severe. "
"8. Disclaimers: Do NOT include any general disclaimer about consulting a licensed professional, as the application handles that separately. "
"9. Dependency Safety: Do not encourage emotional reliance on you; gently support real-world connections when appropriate. "
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
    """Build a combined prompt for the LLM.

    Args:
        user_message: Current user input text.
        emotion: Detected emotion label (e.g., 'anxiety').
        emotion_score: Emotion confidence score (0.0 - 1.0).
        category: Mental health category label (e.g., 'stress disorder').
        category_score: Category confidence score (0.0 - 1.0).
        conversation_history: list of last N message dicts with 'role' and 'content'.

    Returns:
        Formatted prompt string for Llama 3 instruct model.
    """
    # Format conversation history (last 8 messages)
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

    # Build the full prompt in Llama 3 instruct format
    emotion_pct = int(emotion_score * 100)
    category_pct = int(category_score * 100)

    # Adapt system prompt for high-risk situations
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
        f"Respond as the counselor (plain prose only, no lists, no numbers, 2-3 sentences):"
        f"<|eot_id|>"
        f"<|start_header_id|>assistant<|end_header_id|>\n\n"
    )

    return prompt