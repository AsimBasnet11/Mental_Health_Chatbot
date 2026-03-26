"""
Rule-Based Session Summary (Enhancement 3)
Generates a summary card when the user ends the session.
Uses data collected during the conversation — no LLM needed.
"""

from collections import Counter


# Severity order — lower index = more critical
SEVERITY_ORDER = [
    "suicidal", "depression", "bipolar", "personality disorder",
    "anxiety", "normal"
]

CONFIDENCE_THRESHOLD = 0.15  # ignore signals below 15% confidence


def _pick_primary_category(user_messages):
    """Pick the most clinically significant mental health category.

    Priority:
    1. Severity — suicidal always beats anxiety regardless of frequency
    2. Frequency — how many messages had this as top category
    3. Confidence — average score as final tiebreaker

    Only considers categories that pass the confidence threshold.
    Falls back to most frequent if nothing passes threshold.
    """
    # Collect per-message top category + score
    category_stats = {}  # label -> {count, total_score}

    for m in user_messages:
        cat = m.get("category", "")
        score = m.get("category_score", 0.0)
        if not cat or cat.lower() == "unknown":
            continue
        key = cat.lower()
        if key not in category_stats:
            category_stats[key] = {"count": 0, "total_score": 0.0, "original": cat}
        category_stats[key]["count"] += 1
        category_stats[key]["total_score"] += score

    if not category_stats:
        return "unknown"

    total_messages = len(user_messages) or 1

    # Build candidates — non-normal labels passing confidence threshold
    candidates = []
    for key, stats in category_stats.items():
        avg_score = stats["total_score"] / stats["count"]
        if key != "normal" and avg_score >= CONFIDENCE_THRESHOLD:
            freq = stats["count"] / total_messages
            severity_rank = SEVERITY_ORDER.index(key) if key in SEVERITY_ORDER else 98
            # Composite: severity is primary, frequency and confidence break ties
            composite = severity_rank * 10000 - (freq * 50) - (avg_score * 0.5)
            candidates.append({
                "label": stats["original"],
                "composite": composite,
                "avg_score": avg_score,
            })

    if candidates:
        candidates.sort(key=lambda x: x["composite"])
        return candidates[0]["label"]

    # Fallback — everything is normal or below threshold, pick highest avg score
    best = max(category_stats.values(), key=lambda s: s["total_score"] / s["count"])
    return best["original"]


def generate_session_summary(conversation_history):
    """Generate a rule-based session summary from conversation history."""
    user_messages = [m for m in conversation_history if m.get("role") == "user"]

    if not user_messages:
        return {
            "primary_emotion": "N/A",
            "primary_category": "N/A",
            "trend": "N/A",
            "start_score": 0,
            "end_score": 0,
            "recommendation": "No conversation data available.",
            "message_count": 0,
            "summary_text": "No messages were exchanged in this session.",
            "top_emotions": [],
            "avg_distress": 0,
            "risk_flags": [],
        }

    # 1. Most frequent emotion
    emotions = [m.get("emotion", "unknown") for m in user_messages if m.get("emotion")]
    emotion_counts = Counter(emotions)
    primary_emotion = emotion_counts.most_common(1)[0][0] if emotions else "unknown"

    top_emotions = [
        {"emotion": e.title(), "count": c}
        for e, c in emotion_counts.most_common(3)
    ]

    # 2. Primary mental health category — severity-weighted
    primary_category = _pick_primary_category(user_messages)

    # 3. Emotional trend using category_score
    cat_scores = [m.get("category_score", 0.0) for m in user_messages]
    first_score = cat_scores[0]
    last_score  = cat_scores[-1]

    diff = last_score - first_score
    if diff < -0.1:
        trend = "Improved"
    elif diff > 0.1:
        trend = "Worsened"
    else:
        trend = "Stable"

    # 4. Average distress
    avg_distress = round(sum(cat_scores) / len(cat_scores), 3) if cat_scores else 0.0

    # 5. Risk flags
    _RISK_CATEGORIES = {"Suicidal", "Depression", "Bipolar"}
    risk_flags = []
    for idx, m in enumerate(user_messages, 1):
        cat = m.get("category", "")
        score = m.get("category_score", 0)
        if cat == "Suicidal" or (cat in _RISK_CATEGORIES and score >= 0.75):
            risk_flags.append({
                "message_number": idx,
                "category": cat,
                "text_preview": (m.get("content", "")[:60] + "...") if len(m.get("content", "")) > 60 else m.get("content", ""),
                "confidence": round(score, 3),
            })

    # 6. Recommendation
    final_cat_score = user_messages[-1].get("category_score", 0.0)
    primary_lower = primary_category.lower()

    if primary_lower == "suicidal" or any(f["category"] == "Suicidal" for f in risk_flags):
        recommendation = (
            "Suicidal signals were detected during this session. "
            "We strongly recommend reaching out to a crisis helpline (1166 or 1145) "
            "or a trusted mental health professional immediately."
        )
    elif primary_lower == "depression":
        recommendation = (
            "Signs of depression were detected. Please consider speaking with a licensed "
            "mental health professional or medical doctor for proper support."
        )
    elif primary_lower == "bipolar":
        recommendation = (
            "Patterns consistent with bipolar disorder were detected. "
            "We recommend consulting a psychiatrist for a professional evaluation."
        )
    elif primary_lower == "personality disorder":
        recommendation = (
            "Signs of emotional dysregulation were detected. "
            "Speaking with a mental health professional can provide effective coping strategies."
        )
    elif primary_lower == "anxiety" and final_cat_score > 0.5:
        recommendation = "Anxiety patterns were detected. Consider speaking with a counselor for additional support."
    elif final_cat_score > 0.7:
        recommendation = "We strongly recommend speaking with a licensed mental health professional or medical doctor."
    elif final_cat_score > 0.5:
        recommendation = "Consider speaking with a counselor for additional support."
    else:
        recommendation = "You're doing well. Keep practicing self-care and healthy habits."

    # 7. Total messages
    message_count = len(user_messages)

    # 8. Summary text
    start_pct = int(first_score * 100)
    end_pct   = int(last_score * 100)
    avg_pct   = int(avg_distress * 100)

    summary_text = (
        f"Session Summary\n"
        f"{'=' * 40}\n"
        f"Duration: {message_count} messages\n"
        f"Primary emotion: {primary_emotion.title()}\n"
        f"Main concern: {primary_category.title()}\n"
        f"Emotional trend: {trend}\n"
        f"Starting distress: {start_pct}%\n"
        f"Ending distress: {end_pct}%\n"
        f"Average distress: {avg_pct}%\n"
        f"Risk flags: {len(risk_flags)}\n"
        f"Recommendation: {recommendation}\n"
        f"{'=' * 40}"
    )

    return {
        "primary_emotion": primary_emotion,
        "primary_category": primary_category,
        "trend": trend,
        "start_score": first_score,
        "end_score": last_score,
        "avg_distress": avg_distress,
        "recommendation": recommendation,
        "message_count": message_count,
        "summary_text": summary_text,
        "top_emotions": top_emotions,
        "risk_flags": risk_flags,
    }


def end_session(conversation_history):
    """Wrapper called by pipeline.py — delegates to generate_session_summary."""
    if hasattr(conversation_history, 'get_all'):
        history_list = conversation_history.get_all()
    elif hasattr(conversation_history, 'messages'):
        history_list = conversation_history.messages
    elif isinstance(conversation_history, list):
        history_list = conversation_history
    else:
        history_list = []
    return generate_session_summary(history_list)