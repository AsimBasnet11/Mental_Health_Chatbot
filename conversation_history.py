"""
Conversation History Manager
Manages the chat history between user and AI counselor.
Critical for maintaining context across messages.
"""


class ConversationHistory:
    def __init__(self):
        self.messages = []

    def add_user_message(self, content, emotion=None, emotion_score=0.0,
                         category=None, category_score=0.0):
        self.messages.append({
            "role": "user",
            "content": content,
            "emotion": emotion,
            "emotion_score": emotion_score,
            "category": category,
            "category_score": category_score
        })

    def add_assistant_message(self, content):
        self.messages.append({
            "role": "assistant",
            "content": content
        })

    def get_last_n(self, n=8):
        return self.messages[-n:] if len(self.messages) > n else self.messages[:]

    def get_safe_history(self, max_tokens=1500):
        """Return history that fits within token budget.
        Estimates tokens as word_count * 1.3.
        Always keeps at least the last 2 messages.
        Only returns role + content — strips metadata keys.
        """
        history = self.messages[:]
        while len(history) > 2:
            total_words = sum(len(m["content"].split()) for m in history)
            estimated_tokens = int(total_words * 1.3)
            if estimated_tokens <= max_tokens:
                break
            history.pop(0)
        return [{"role": m["role"], "content": m["content"]} for m in history]

    def get_all(self):
        return self.messages[:]

    def get_score_history(self):
        """Return list of score dicts for sentiment trend graph."""
        scores = []
        msg_num = 0
        for m in self.messages:
            if m["role"] == "user":
                msg_num += 1
                scores.append({
                    "message_number": msg_num,
                    "emotion": m.get("emotion", ""),
                    "emotion_score": m.get("emotion_score", 0.0),
                    "category": m.get("category", ""),
                    "category_score": m.get("category_score", 0.0)
                })
        return scores

    def clear(self):
        self.messages = []

    def __len__(self):
        return len(self.messages)