import re as _re
import logging as _logging

from input_gate import check_input
from prompt_builder import build_prompt
from safety_guardrails import apply_safety_guardrails
from conversation_history import ConversationHistory
from session_summary import generate_session_summary
from detection import detect_emotion, classify_mental_health_with_scores

_log = _logging.getLogger("mindcare.pipeline")
_llm_responder = None


def _get_llm_responder():
    global _llm_responder
    if _llm_responder is None:
        from llm_responder import LLMResponder
        _llm_responder = LLMResponder()
    return _llm_responder

_GATE_RESPONSE_STATUSES = {
    "greeting", "too_short", "off_topic",
    "hard_refuse", "harmful_validation", "unsafe_advice", "dependency",
    "hidden_intent", "step_by_step", "coercion", "validation_trap",
    "contradictory", "philosophical", "jailbreak", "diagnostic",
    "medication_advice", "manipulation", "delusion", "minimization",
    "harmful_coping", "stigma", "persistence", "aggression", "responsibility",
}

_RUN_DETECTION_STATUSES = {
    "proceed", "crisis_1", "crisis_2", "crisis_3",
    "harmful_validation", "dependency", "hidden_intent",
    "coercion", "validation_trap", "contradictory", "philosophical",
    "delusion", "minimization", "harmful_coping",
}

def _diversity_score(resp, recent):
    """Score response diversity vs recent responses. Higher = more diverse."""
    if not recent:
        return 1.0
    resp_words = set(resp[:60].lower().split())
    overlaps = [
        len(resp_words & set(r.split())) / max(len(resp_words), 1)
        for r in recent
    ]
    return 1.0 - (sum(overlaps) / len(overlaps))


def process_user_input(user_message, conversation_history):
    """Main pipeline function: all features active, LLM gets raw chat history."""

    # Step 1: Input Gate
    has_history = len(conversation_history) > 0
    gate_result = check_input(user_message, has_history=has_history, llm_instance=_get_llm_responder())
    status = gate_result["status"]

    # Step 2 & 3: Detection
    if status in _RUN_DETECTION_STATUSES:
        emotion, emotion_score = detect_emotion(user_message)
        category, category_score, all_scores = classify_mental_health_with_scores(user_message)
    else:
        emotion, emotion_score = None, 0.0
        category, category_score, all_scores = None, 0.0, {}

    if status != "proceed":
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

    # Step 4: Store user message
    conversation_history.add_user_message(
        user_message, emotion, emotion_score, category, category_score
    )

    # Step 5: Build chat history with MentalChat16K system prompt prepended.
    # Matches the exact instruction the counselor model was trained on.
    from prompt_builder import SYSTEM_PROMPT
    history_for_prompt = conversation_history.get_safe_history()
    chat_history = [{"role": "system", "content": SYSTEM_PROMPT}] + history_for_prompt[-6:]

    # Step 6: max_tokens — counselor model needs room for full responses
    is_list_req = False   # MentalChat16K model outputs prose, not lists
    max_tok = 512

    # Step 7: LLM — collect recent aria responses for diversity check
    _recent_aria = [
        m["content"][:60].lower()
        for m in conversation_history.messages
        if m.get("role") == "assistant"
    ][-3:]

    _turn_count = sum(
        1 for m in conversation_history.messages if m.get("role") == "user"
    )

    llm = _get_llm_responder()

    # Multi-response re-ranking only after 3+ turns and not for lists
    if _turn_count >= 3 and not is_list_req:
        candidates = [
            llm.generate_response(chat_history, max_tokens=max_tok, emotion=emotion, category=category, turn_count=_turn_count),
            llm.generate_response(chat_history, max_tokens=max_tok, emotion=emotion, category=category, turn_count=_turn_count),
        ]
        scores = [_diversity_score(c, _recent_aria) for c in candidates]
        best_idx = scores.index(max(scores))
        response = candidates[best_idx]
        _log.debug("Multi-response: scores=%s selected=%d", scores, best_idx)
    else:
        response = llm.generate_response(chat_history, max_tokens=max_tok, emotion=emotion, category=category, turn_count=_turn_count)

    # Step 8: Safety Guardrails
    num_match = _re.search(
        r'\b(\d+)\s*(items?|points?|tips?|ways?|steps?|remedies|things|list)\b'
        r'|\b(give|show|list)\s+me\s+(\d+)\b',
        user_message, _re.IGNORECASE
    )
    requested_count = None
    if num_match:
        num_str = num_match.group(1) or num_match.group(4)
        if num_str:
            requested_count = int(num_str)

    response = apply_safety_guardrails(
        response, category_score,
        category=category, requested_list_count=requested_count,
        crisis_level=gate_result.get("crisis_level", 0)
    )

    # Step 9: Store AI response
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
    """Generate session summary."""
    try:
        if hasattr(conversation_history, 'get_all'):
            history_list = conversation_history.get_all()
        elif hasattr(conversation_history, 'messages'):
            history_list = conversation_history.messages
        elif isinstance(conversation_history, list):
            history_list = conversation_history
        else:
            history_list = []

        user_msgs = [m for m in history_list if m.get("role") == "user"]
        _log.info("end_session: %d user messages", len(user_msgs))

        return generate_session_summary(history_list)
    except Exception as e:
        _log.error("end_session failed: %s", e)
        return {
            "primary_emotion": "N/A",
            "primary_category": "N/A",
            "trend": "N/A",
            "start_score": 0,
            "end_score": 0,
            "recommendation": "Unable to generate summary.",
            "message_count": 0,
            "summary_text": "Summary could not be generated.",
            "top_emotions": [],
            "avg_distress": 0,
            "risk_flags": [],
        }