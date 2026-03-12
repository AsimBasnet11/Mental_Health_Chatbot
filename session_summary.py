"""
Rule-Based Session Summary (Enhancement 3)
Generates a summary card when the user ends the session.
Uses data collected during the conversation — no LLM needed.
"""

from collections import Counter


def generate_session_summary(conversation_history):
    """Generate a rule-based session summary from conversation history.

    Args:
        conversation_history: list of message dicts. User messages have keys:
            role, content, emotion, emotion_score, category, category_score.

    Returns:
        dict with summary fields:
            primary_emotion, primary_category, trend, start_score,
            end_score, recommendation, message_count, summary_text
    """
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
            "summary_text": "No messages were exchanged in this session."
        }

    # 1. Most frequent emotion
    emotions = [m.get("emotion", "unknown") for m in user_messages if m.get("emotion")]
    primary_emotion = Counter(emotions).most_common(1)[0][0] if emotions else "unknown"

    # 2. Most frequent mental health category
    categories = [m.get("category", "unknown") for m in user_messages if m.get("category")]
    primary_category = Counter(categories).most_common(1)[0][0] if categories else "unknown"

    # 3. Emotional trend: compare first vs last emotion_score
    first_score = user_messages[0].get("emotion_score", 0.0)
    last_score = user_messages[-1].get("emotion_score", 0.0)

    diff = last_score - first_score
    if diff < -0.1:
        trend = "Improved"
    elif diff > 0.1:
        trend = "Worsened"
    else:
        trend = "Stable"

    # 4. Recommendation based on final category_score
    final_cat_score = user_messages[-1].get("category_score", 0.0)
    if final_cat_score > 0.8:
        recommendation = "We strongly recommend speaking with a professional."
    elif final_cat_score > 0.5:
        recommendation = "Consider speaking with a counselor for additional support."
    else:
        recommendation = "Continue practicing self-care and healthy habits."

    # 5. Total messages
    message_count = len(user_messages)

    # 6. Build summary text
    start_pct = int(first_score * 100)
    end_pct = int(last_score * 100)

    summary_text = (
        f"Session Summary\n"
        f"{'=' * 40}\n"
        f"Duration: {message_count} messages\n"
        f"Primary emotion: {primary_emotion.title()}\n"
        f"Main concern: {primary_category.title()}\n"
        f"Emotional trend: {trend}\n"
        f"Starting distress: {start_pct}%\n"
        f"Ending distress: {end_pct}%\n"
        f"Recommendation: {recommendation}\n"
        f"{'=' * 40}"
    )

    return {
        "primary_emotion": primary_emotion,
        "primary_category": primary_category,
        "trend": trend,
        "start_score": first_score,
        "end_score": last_score,
        "recommendation": recommendation,
        "message_count": message_count,
        "summary_text": summary_text
    }
