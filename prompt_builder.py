"""
Prompt Builder (Task 3)
Combines user message, conversation history, and RAG example into a
structured prompt for the LLM. Emotion metrics are intentionally excluded.
Uses Llama 3 instruct template format.
"""


SYSTEM_PROMPT = (
    "You are an empathetic mental health counselor named Aria. "
    "You chat naturally like a caring friend — keep replies SHORT (1 to 3 sentences). "
    "Match the length of the user's message: short input = short reply. "
    "Ask ONE follow-up question to keep the conversation going. "
    "Never write long paragraphs or lists. Never repeat what the user said. "
    "Never diagnose or prescribe medication. "
    "Recommend professional help only for serious concerns. "
    "Do NOT add any disclaimer or reminder about consulting a licensed "
    "professional at the end of your responses. The application handles this separately."
)

# Additional system-level instruction when a high-risk category is detected
_HIGH_RISK_CATEGORIES = {"Suicidal", "Depression", "Bipolar"}

_CRISIS_SYSTEM_ADDON = (
    " The user may be in distress. Prioritize safety — validate their feelings, "
    "express genuine concern, and gently encourage contacting a crisis helpline (988) "
    "or a trusted person. Do NOT minimize their pain."
)


def build_prompt(user_message, emotion, emotion_score, category, category_score,
                 rag_example, conversation_history):
    """Build a combined prompt for the LLM.

    Args:
        user_message: Current user input text.
        emotion: Detected emotion label (e.g., 'anxiety').
        emotion_score: Emotion confidence score (0.0 - 1.0).
        category: Mental health category label (e.g., 'stress disorder').
        category_score: Category confidence score (0.0 - 1.0).
        rag_example: dict with 'question' and 'answer' keys from RAG search, or None.
        conversation_history: list of last N message dicts with 'role' and 'content'.

    Returns:
        Formatted prompt string for Llama 3 instruct model.
    """
    # Format full in-session conversation history.
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

    # Format RAG example (only if a match was returned)
    rag_block = ""
    if rag_example and rag_example.get("question"):
        rag_block = (
            f"Similar question: {rag_example.get('question', '')}\n"
            f"Example response style (do NOT copy verbatim): {rag_example.get('answer', '')}"
        )

    # Adapt system prompt for high-risk situations
    system = SYSTEM_PROMPT
    if category in _HIGH_RISK_CATEGORIES and category_score >= 0.55:
        system += _CRISIS_SYSTEM_ADDON

    prompt = (
        f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n"
        f"{system}<|eot_id|>"
        f"<|start_header_id|>user<|end_header_id|>\n\n"
    )

    if rag_block:
        prompt += (
            f"REFERENCE EXAMPLE FROM THERAPY DATABASE:\n"
            f"{rag_block}\n\n"
        )

    if history_block:
        prompt += (
            f"CONVERSATION HISTORY (current session):\n"
            f"{history_block}\n\n"
        )

    prompt += (
        f"USER MESSAGE:\n{user_message}\n\n"
        f"Respond as the counselor:<|eot_id|>"
        f"<|start_header_id|>assistant<|end_header_id|>\n\n"
    )

    return prompt