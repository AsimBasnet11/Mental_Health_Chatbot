"""
Prompt Builder (Task 3)
Combines user message, conversation history, emotion, classification,
and RAG example into a structured prompt for the LLM.
Uses Llama 3 instruct template format.
"""


SYSTEM_PROMPT = (
    "You are an empathetic mental health counselor named Aria. "
    "You chat naturally like a caring friend — keep replies SHORT (1 to 3 sentences). "
    "Match the length of the user's message: short input = short reply. "
    "Ask ONE follow-up question to keep the conversation going. "
    "Never write long paragraphs or lists. Never repeat what the user said. "
    "Never diagnose or prescribe medication. "
    "Recommend professional help only for serious concerns."
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
        rag_example: dict with 'question' and 'answer' keys from RAG search.
        conversation_history: list of last N message dicts with 'role' and 'content'.

    Returns:
        Formatted prompt string for Llama 3 instruct model.
    """
    # Format conversation history (last 8 messages)
    history_block = ""
    if conversation_history:
        history_lines = []
        for msg in conversation_history[-8:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                history_lines.append(f"User: {content}")
            else:
                history_lines.append(f"Assistant: {content}")
        history_block = "\n".join(history_lines)

    # Format RAG example
    rag_block = ""
    if rag_example:
        rag_block = (
            f"Similar question: {rag_example.get('question', '')}\n"
            f"Example response: {rag_example.get('answer', '')}"
        )

    # Build the full prompt in Llama 3 instruct format
    emotion_pct = int(emotion_score * 100)
    category_pct = int(category_score * 100)

    prompt = (
        f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n"
        f"{SYSTEM_PROMPT}<|eot_id|>"
        f"<|start_header_id|>user<|end_header_id|>\n\n"
        f"CONTEXT FROM ANALYSIS:\n"
        f"Detected Emotion: {emotion} (confidence: {emotion_pct}%)\n"
        f"Mental Health Category: {category} (confidence: {category_pct}%)\n\n"
    )

    if rag_block:
        prompt += (
            f"REFERENCE EXAMPLE FROM THERAPY DATABASE:\n"
            f"{rag_block}\n\n"
        )

    if history_block:
        prompt += (
            f"CONVERSATION HISTORY (last messages):\n"
            f"{history_block}\n\n"
        )

    prompt += (
        f"USER MESSAGE:\n{user_message}\n\n"
        f"Respond as the counselor:<|eot_id|>"
        f"<|start_header_id|>assistant<|end_header_id|>\n\n"
    )

    return prompt
