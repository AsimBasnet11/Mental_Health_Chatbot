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
        rag_example: dict with 'question' and 'answer' keys from RAG search, or None.
        conversation_history: list of last N message dicts with 'role' and 'content'.

    Returns:
        Formatted prompt string for Llama 3 instruct model.
    """
    # Build system section with analysis context embedded
    emotion_pct = int(emotion_score * 100)
    category_pct = int(category_score * 100)

    system_section = SYSTEM_PROMPT + "\n\n"
    system_section += (
        f"The user's current emotional state is: {emotion} ({emotion_pct}% confidence). "
        f"Mental health context: {category} ({category_pct}% confidence). "
        "Use this to guide your tone — do NOT mention these labels in your reply."
    )

    if rag_example:
        system_section += (
            f"\n\nFor reference, here is an example therapist response to a similar concern:\n"
            f"\"{rag_example.get('answer', '')}\"\n"
            "Use this as inspiration for tone and approach, but respond naturally to the user's actual words."
        )

    # Format conversation history as multi-turn dialogue
    prompt = (
        f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n"
        f"{system_section}<|eot_id|>"
    )

    # Add conversation history as alternating user/assistant turns
    if conversation_history:
        for msg in conversation_history[-6:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            prompt += (
                f"<|start_header_id|>{role}<|end_header_id|>\n\n"
                f"{content}<|eot_id|>"
            )

    # Add current user message
    prompt += (
        f"<|start_header_id|>user<|end_header_id|>\n\n"
        f"{user_message}<|eot_id|>"
        f"<|start_header_id|>assistant<|end_header_id|>\n\n"
    )

    return prompt
