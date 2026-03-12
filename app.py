"""
Flask API Backend
REST API that connects the full pipeline to the React frontend.
Serves: /analyze (emotion+classification), /api/chat (full LLM pipeline),
        /api/sentiment, /api/summary, /api/history
"""

import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS

# Add project root to path
sys.path.insert(0, os.path.dirname(__file__))

from conversation_history import ConversationHistory
from pipeline import process_user_input, end_session
from detection import detect_emotion, classify_mental_health, analyze_full

app = Flask(__name__)
CORS(app)

# Store active sessions
sessions = {}


def get_session(session_id):
    if session_id not in sessions:
        sessions[session_id] = ConversationHistory()
    return sessions[session_id]


# ─── EXISTING REACT APP ENDPOINT (emotion + classification only) ────

@app.route("/analyze", methods=["POST"])
def analyze():
    """Analyze text for emotion and mental health classification.
    This matches the existing React app's expected API contract.

    Request JSON:
        { "text": "user text" }

    Response JSON:
        { "emotion": { "label": "...", "confidence": 0.87 },
          "mental_state": { "label": "...", "confidence": 0.91 },
          "high_risk": false }
    """
    data = request.get_json()
    if not data or "text" not in data:
        return jsonify({"error": "Missing 'text' field"}), 400

    text = data["text"]
    result = analyze_full(text)
    return jsonify(result)


@app.route("/api/chat", methods=["POST"])
def chat():
    """Process a user message through the full pipeline.

    Request JSON:
        { "message": "user text", "session_id": "optional-session-id" }

    Response JSON:
        { "response": "AI text", "emotion": "...", "emotion_score": 0.87,
          "category": "...", "category_score": 0.91, "show_analysis": true,
          "gate_status": "proceed" }
    """
    data = request.get_json()
    if not data or "message" not in data:
        return jsonify({"error": "Missing 'message' field"}), 400

    user_message = data["message"]
    session_id = data.get("session_id", "default")
    history = get_session(session_id)

    result = process_user_input(user_message, history)
    return jsonify(result)


@app.route("/api/sentiment", methods=["GET"])
def sentiment():
    """Get sentiment trend data for the session.

    Query params: session_id (optional, defaults to 'default')

    Response JSON:
        { "scores": [ { "message_number": 1, "emotion": "...",
          "emotion_score": 0.87, "category": "...", "category_score": 0.91 }, ... ] }
    """
    session_id = request.args.get("session_id", "default")
    history = get_session(session_id)
    scores = history.get_score_history()
    return jsonify({"scores": scores})


@app.route("/api/summary", methods=["POST"])
def summary():
    """Generate session summary and end the session.

    Request JSON:
        { "session_id": "optional-session-id" }

    Response JSON:
        { "primary_emotion": "...", "primary_category": "...",
          "trend": "Improved", "start_score": 0.87, "end_score": 0.45,
          "recommendation": "...", "message_count": 8, "summary_text": "..." }
    """
    data = request.get_json() or {}
    session_id = data.get("session_id", "default")
    history = get_session(session_id)

    result = end_session(history)

    # Clear the session after summary
    if session_id in sessions:
        del sessions[session_id]

    return jsonify(result)


@app.route("/api/history", methods=["GET"])
def get_history():
    """Get full conversation history for a session.

    Query params: session_id (optional)

    Response JSON:
        { "messages": [ { "role": "user", "content": "..." }, ... ] }
    """
    session_id = request.args.get("session_id", "default")
    history = get_session(session_id)
    return jsonify({"messages": history.get_all()})


if __name__ == "__main__":
    print("=" * 50)
    print("  Mental Health AI Chatbot — Aria (Backend)")
    print("  API running at http://127.0.0.1:8000")
    print("  React frontend: run 'npm run dev' separately")
    print("=" * 50)
    app.run(host="127.0.0.1", port=8000, debug=True)
