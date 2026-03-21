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


# ── Statuses where gate response is used directly (skip LLM) ──
_GATE_RESPONSE_STATUSES = {
    "greeting", "too_short", "off_topic",
    "hard_refuse", "harmful_validation", "unsafe_advice", "dependency",
    "hidden_intent", "step_by_step", "coercion", "validation_trap",
    "contradictory", "philosophical", "jailbreak", "diagnostic",
    "medication_advice", "manipulation", "delusion", "minimization",
    "harmful_coping", "stigma", "persistence", "aggression", "responsibility",
}

# ── Statuses where detection still runs (for Mental State page) ──
_RUN_DETECTION_STATUSES = {
    "proceed", "crisis_1", "crisis_2", "crisis_3",
    "harmful_validation", "dependency", "hidden_intent",
    "coercion", "validation_trap", "contradictory", "philosophical",
    "delusion", "minimization", "harmful_coping",
}

# ─── MAIN PIPELINE ──────────────────────────────────────────────────

def process_user_input(user_message, conversation_history):
    """Main pipeline function that processes a user message end to end."""
    import re as _re

    # Step 1: Input Gate — pass history so short contextual replies go to LLM
    has_history = len(conversation_history) > 0
    gate_result = check_input(user_message, has_history=has_history)
    status = gate_result["status"]

    # Step 2 & 3: Detection — run for meaningful/crisis messages only
    if status in _RUN_DETECTION_STATUSES:
        emotion, emotion_score = detect_emotion(user_message)
        category, category_score, all_scores = classify_mental_health_with_scores(user_message)
    else:
        emotion, emotion_score = None, 0.0
        category, category_score, all_scores = None, 0.0, {}

    if status != "proceed":
        # Gate response — store and return
        conversation_history.add_user_message(
            user_message, emotion, emotion_score, category, category_score
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
    conversation_history.add_user_message(
        user_message, emotion, emotion_score, category, category_score
    )

    # Step 5: Build Prompt
    history_for_prompt = conversation_history.get_safe_history()
    prompt = build_prompt(
        user_message, emotion, emotion_score,
        category, category_score, history_for_prompt
    )

    # Step 6: Dynamic max_tokens — more for list requests
    _is_list_req = _re.search(
        r'\b(list|lists|steps|tips|ways|remedies|techniques|strategies|methods|\d+\s*items?)\b',
        user_message, _re.IGNORECASE
    )
    _max_tok = 700 if _is_list_req else 300

    # Step 7: LLM Response
    llm = _get_llm_responder()
    response = llm.generate_response(prompt, max_tokens=_max_tok)

    # Step 8: Safety Guardrails — detect requested list count
    _num_match = _re.search(
        r'\b(\d+)\s*(items?|points?|tips?|ways?|steps?|remedies|things|list)\b|\b(give|show|list)\s+me\s+(\d+)\b',
        user_message, _re.IGNORECASE
    )
    _requested_count = None
    if _num_match:
        _num_str = _num_match.group(1) or _num_match.group(4)
        if _num_str:
            _requested_count = int(_num_str)

    response = apply_safety_guardrails(
        response, emotion_score, category_score,
        category=category, requested_list_count=_requested_count
    )

    # Step 9: Store AI response in history
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
        conversation_history: ConversationHistory instance or list.

    Returns:
        dict with session summary data.
    """
    try:
        if hasattr(conversation_history, 'get_all'):
            history_list = conversation_history.get_all()
        elif hasattr(conversation_history, 'messages'):
            history_list = conversation_history.messages
        elif isinstance(conversation_history, list):
            history_list = conversation_history
        else:
            history_list = []

        # Debug logging — check what we actually received
        import logging
        _log = logging.getLogger("mindcare.pipeline")
        _log.info("end_session: total messages = %d", len(history_list))
        user_msgs = [m for m in history_list if m.get("role") == "user"]
        _log.info("end_session: user messages = %d", len(user_msgs))
        if user_msgs:
            sample = user_msgs[0]
            _log.info("end_session: first user msg keys = %s", list(sample.keys()))
            _log.info("end_session: emotion=%s category=%s score=%s",
                      sample.get("emotion"), sample.get("category"), sample.get("category_score"))
        else:
            _log.warning("end_session: NO user messages found — summary will be empty")

        return generate_session_summary(history_list)
    except Exception as e:
        import logging
        logging.getLogger("mindcare.pipeline").error("end_session failed: %s", e)
        return {
            "primary_emotion": "N/A",
            "primary_category": "N/A",
            "trend": "N/A",
            "start_score": 0,
            "end_score": 0,
            "recommendation": "Unable to generate summary. Please try again.",
            "message_count": 0,
            "summary_text": "Summary could not be generated for this session.",
            "top_emotions": [],
            "avg_distress": 0,
            "risk_flags": [],
        }