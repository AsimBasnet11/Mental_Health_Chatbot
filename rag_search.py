"""
RAG Search Logic
Uses sentence-transformers to find the most similar therapy Q&A from rag_data.json.
Model: all-MiniLM-L6-v2 (small, fast, runs locally).
"""

import json
import os
import numpy as np
from sentence_transformers import SentenceTransformer, util


class RAGSearch:
    def __init__(self, rag_data_path=None):
        if rag_data_path is None:
            rag_data_path = os.path.join(os.path.dirname(__file__), "rag_data.json")

        self.model = SentenceTransformer("all-MiniLM-L6-v2")

        with open(rag_data_path, "r", encoding="utf-8") as f:
            self.rag_data = json.load(f)

        # Pre-compute embeddings for all questions at startup
        self.questions = [item["question"] for item in self.rag_data]
        self.question_embeddings = self.model.encode(self.questions, convert_to_tensor=True)

    def get_rag_example(self, user_message):
        """Find the most similar Q&A pair to the user's message.

        Args:
            user_message: The user's input text.

        Returns:
            dict with keys 'question' and 'answer' from the best match.
        """
        user_embedding = self.model.encode(user_message, convert_to_tensor=True)
        similarities = util.cos_sim(user_embedding, self.question_embeddings)[0]
        best_idx = int(similarities.argmax())
        best_score = float(similarities[best_idx])

        return {
            "question": self.rag_data[best_idx]["question"],
            "answer": self.rag_data[best_idx]["answer"],
            "similarity_score": best_score
        }
