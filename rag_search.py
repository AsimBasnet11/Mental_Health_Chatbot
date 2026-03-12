"""
RAG Search Logic
Uses sentence-transformers to find the most similar therapy Q&A from rag_data.json.
Model: all-MiniLM-L6-v2 (small, fast, runs locally).
"""

import json
import os
import logging
import numpy as np
from sentence_transformers import SentenceTransformer, util

log = logging.getLogger("mindcare.rag")

# Minimum cosine similarity to consider a RAG match useful
RAG_MIN_SIMILARITY = 0.35


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
        log.info("RAG loaded %d Q&A pairs", len(self.rag_data))

    def get_rag_example(self, user_message, top_k=1):
        """Find the most similar Q&A pair to the user's message.

        Args:
            user_message: The user's input text.
            top_k: Number of top matches to consider (returns best above threshold).

        Returns:
            dict with keys 'question', 'answer', 'similarity_score'
            or None if no match exceeds RAG_MIN_SIMILARITY.
        """
        user_embedding = self.model.encode(user_message, convert_to_tensor=True)
        similarities = util.cos_sim(user_embedding, self.question_embeddings)[0]
        best_idx = int(similarities.argmax())
        best_score = float(similarities[best_idx])

        if best_score < RAG_MIN_SIMILARITY:
            log.debug("RAG: best score %.3f below threshold %.2f — skipping", best_score, RAG_MIN_SIMILARITY)
            return None

        return {
            "question": self.rag_data[best_idx]["question"],
            "answer": self.rag_data[best_idx]["answer"],
            "similarity_score": best_score
        }
