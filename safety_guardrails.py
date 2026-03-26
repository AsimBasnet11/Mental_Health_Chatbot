# Dummy safety_guardrails.py for pipeline compatibility

def apply_safety_guardrails(response, emotion_score, category_score, category=None, requested_list_count=None):
    # No-op in raw mode, return response unchanged
    return response
