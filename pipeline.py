"""
Full Pipeline (Task 5)
Connects every component in the correct order.
This is the core engine of the chatbot.

Components connected:
1. Input Gate → 2. Emotion Detection → 3. Mental Health Classification →
4. Conversation History → 5. RAG Search → 6. Prompt Builder →
7. LLM Response → 8. Safety Guardrails → 9. Return result

Note: Emotion Detection and Mental Health Classification models are assumed
to already exist. This module provides stub functions that should be replaced
with the actual model inference calls from the existing completed components.
"""

import os
from input_gate import check_input
from prompt_builder import build_prompt
from safety_guardrails import apply_safety_guardrails
from conversation_history import ConversationHistory
from session_summary import generate_session_summary
from detection import detect_emotion, classify_mental_health

# These are loaded lazily to avoid slow imports at module level
_rag_search = None
_llm_responder = None


def _get_rag_search():
    global _rag_search
    if _rag_search is None:
        from rag_search import RAGSearch
        _rag_search = RAGSearch()
    return _rag_search


def _get_llm_responder():
    global _llm_responder
    if _llm_responder is None:
        from llm_responder import LLMResponder
        _llm_responder = LLMResponder()
    return _llm_responder


# detect_emotion and classify_mental_health are imported from detection.py
# They use the trained models in Detection/Goemotion-detection/ and Detection/Sentimental-analysis/


# ─── MAIN PIPELINE ──────────────────────────────────────────────────

def process_user_input(user_message, conversation_history, pre_analysis=None):
    """Main pipeline function that processes a user message end to end.

    Args:
        user_message: The user's input text (from ASR or typed).
        conversation_history: ConversationHistory instance.
        pre_analysis: Optional dict with pre-computed emotion/category from /analyze.
            Keys: emotion, emotion_score, category, category_score.
            If provided, skips re-running detection models.

    Returns:
        dict with keys:
            - response: The AI response text
            - emotion: Detected emotion label (or None)
            - emotion_score: Emotion confidence (or None)
            - category: Mental health category (or None)
            - category_score: Category confidence (or None)
            - show_analysis: Whether to display emotion/category in UI
            - gate_status: The input gate result status
    """
    # Step 1: Input Gate
    gate_result = check_input(user_message)

    if gate_result["status"] != "proceed":
        # For non-proceed statuses, still store in history for completeness
        conversation_history.add_user_message(user_message)
        conversation_history.add_assistant_message(gate_result["response"])
        return {
            "response": gate_result["response"],
            "emotion": None,
            "emotion_score": None,
            "category": None,
            "category_score": None,
            "show_analysis": False,
            "gate_status": gate_result["status"]
        }

    # Step 2 & 3: Use pre-computed analysis if available, otherwise detect
    if pre_analysis:
        emotion = pre_analysis.get("emotion")
        emotion_score = pre_analysis.get("emotion_score", 0.0)
        category = pre_analysis.get("category")
        category_score = pre_analysis.get("category_score", 0.0)
    else:
        emotion, emotion_score = detect_emotion(user_message)
        category, category_score = classify_mental_health(user_message)

    # Step 4: Get history BEFORE adding current message (avoid duplication)
    history_for_prompt = conversation_history.get_safe_history()

    # Step 4b: Now store in conversation history
    conversation_history.add_user_message(
        user_message, emotion, emotion_score, category, category_score
    )

    # Step 5: RAG Search (only use if similarity is high enough)
    rag = _get_rag_search()
    rag_result = rag.get_rag_example(user_message)
    rag_example = rag_result if rag_result.get("similarity_score", 0) > 0.45 else None

    # Step 6: Build Prompt
    prompt = build_prompt(
        user_message, emotion, emotion_score,
        category, category_score, rag_example, history_for_prompt
    )

    # Step 7: LLM Response
    llm = _get_llm_responder()
    response = llm.generate_response(prompt)

    # Step 8: Safety Guardrails
    response = apply_safety_guardrails(response, emotion_score, category_score)

    # Step 9: Store AI response in history
    conversation_history.add_assistant_message(response)

    return {
        "response": response,
        "emotion": emotion,
        "emotion_score": emotion_score,
        "category": category,
        "category_score": category_score,
        "show_analysis": True,
        "gate_status": "proceed"
    }


def end_session(conversation_history):
    """Generate session summary when user ends the conversation.

    Args:
        conversation_history: ConversationHistory instance.

    Returns:
        dict with session summary data.
    """
    return generate_session_summary(conversation_history.get_all())
