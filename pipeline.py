"""
Full Pipeline (Task 5)
Connects every component in the correct order.
This is the core engine of the chatbot.

Components connected:
1. Input Gate → 2. Emotion Detection → 3. Mental Health Classification →
4. Conversation History → 5. Prompt Builder →
6. LLM Response → 7. Safety Guardrails → 8. Return result
"""

import os
from input_gate import check_input
from prompt_builder import build_prompt
from safety_guardrails import apply_safety_guardrails
from conversation_history import ConversationHistory
from session_summary import generate_session_summary
from detection import detect_emotion, classify_mental_health, classify_mental_health_with_scores

# These are loaded lazily to avoid slow imports at module level
_llm_responder = None


def _get_llm_responder():
    global _llm_responder
    if _llm_responder is None:
        from llm_responder import LLMResponder
        _llm_responder = LLMResponder()
    return _llm_responder


# detect_emotion and classify_mental_health are imported from detection.py
# They use the trained models in Detection/Goemotion-detection/ and Detection/Sentimental-analysis/

# ── Statuses where we use the gate response directly (skip LLM) ──
_GATE_RESPONSE_STATUSES = {
    "greeting", "too_short", "off_topic",
    "hard_refuse", "harmful_validation", "unsafe_advice", "dependency",
    "hidden_intent", "step_by_step", "coercion", "validation_trap",
    "contradictory", "philosophical", "jailbreak", "diagnostic",
    "medication_advice", "manipulation", "delusion", "minimization",
    "harmful_coping", "stigma", "persistence",
}

# ── Statuses where we still run detection (for Mental State page) ──
_RUN_DETECTION_STATUSES = {
    "proceed", "crisis_1", "crisis_2", "crisis_3",
    "harmful_validation", "dependency", "hidden_intent",
    "coercion", "validation_trap", "contradictory", "philosophical",
    "delusion", "minimization", "harmful_coping",
}


# ─── MAIN PIPELINE ──────────────────────────────────────────────────

def process_user_input(user_message, conversation_history):
    """Main pipeline function that processes a user message end to end.

    Args:
        user_message: The user's input text (from ASR or typed).
        conversation_history: ConversationHistory instance.

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
    # Step 1: Input Gate — pass history flag so short contextual replies
    # like "yes", "no", "fine" are handled by LLM instead of too_short gate
    has_history = len(conversation_history) > 0
    gate_result = check_input(user_message, has_history=has_history)
    status = gate_result["status"]

    # Step 2 & 3: Detection — only run for meaningful/crisis messages.
    # Skip for greetings, too_short, off_topic, hard_refuse to avoid noisy
    # data in Mental State page. Still run for harmful_validation and
    # dependency so Mental State page captures those emotional states.
    if status in _RUN_DETECTION_STATUSES:
        emotion, emotion_score = detect_emotion(user_message)
        category, category_score, all_scores = classify_mental_health_with_scores(user_message)
    else:
        emotion, emotion_score = None, 0.0
        category, category_score, all_scores = None, 0.0, {}

    if status != "proceed":
        # Non-proceed: store detection results but use gate response, skip LLM
        high_risk = category == "Suicidal"
        conversation_history.add_user_message(
            user_message, emotion, emotion_score, category, category_score, high_risk
        )
        conversation_history.add_assistant_message(gate_result["response"])
        return {
            "response": gate_result["response"],
            "emotion": emotion,
            "emotion_score": emotion_score,
            "category": category,
            "category_score": category_score,
            "all_scores": all_scores,
            "show_analysis": status in _RUN_DETECTION_STATUSES,
            "gate_status": status,
        }

    # Step 4: Store in conversation history
    high_risk = category == "Suicidal"
    conversation_history.add_user_message(
        user_message, emotion, emotion_score, category, category_score, high_risk
    )

    # Step 5: Build Prompt (RAG removed)
    history_for_prompt = conversation_history.get_safe_history()
    prompt = build_prompt(
        user_message, emotion, emotion_score,
        category, category_score, history_for_prompt
    )

    # Step 6: LLM Response
    llm = _get_llm_responder()
    response = llm.generate_response(prompt)

    # Step 7: Safety Guardrails
    response = apply_safety_guardrails(response, emotion_score, category_score,
                                       category=category)

    # Step 8: Store AI response in history
    conversation_history.add_assistant_message(response)

    return {
        "response": response,
        "emotion": emotion,
        "emotion_score": emotion_score,
        "category": category,
        "category_score": category_score,
        "all_scores": all_scores,
        "show_analysis": True,
        "gate_status": "proceed",
    }


def end_session(conversation_history):
    """Generate session summary when user ends the conversation.

    Args:
        conversation_history: ConversationHistory instance.

    Returns:
        dict with session summary data.
    """
    return generate_session_summary(conversation_history.get_all())