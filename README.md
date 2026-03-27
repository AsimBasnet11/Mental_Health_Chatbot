
# Mental Health AI Chatbot — Aria

## Overview

Aria is an AI-powered mental health chatbot designed to provide real-time emotional support, mental health analysis, and counseling responses. It leverages advanced NLP models for emotion detection, sentiment analysis, and LLM-based conversational guidance. The system is intended for users seeking a supportive, private, and interactive mental health companion.

## Features

- Real-time emotion and mental health analysis (GoEmotions, RoBERTa)
- LLM-powered counseling responses (Llama 3)
- Voice input with ASR (Faster Whisper, Google Colab)
- Session summaries and chat history
- Modern React frontend with live sentiment graph
- Easy deployment (Colab or local)


## Project Structure

```
finalized model/
├── app.py                      # Flask API backend (run this first)
├── pipeline.py                 # Full pipeline connecting all components
├── conversation_history.py     # Conversation history manager
├── input_gate.py               # Input gate / filter with 3 crisis levels
├── prompt_builder.py           # Prompt builder for Llama 3 instruct
├── llm_responder.py            # LLM response generator (local or remote Colab)
├── safety_guardrails.py        # Post-response safety rules
├── session_summary.py          # Rule-based session summary
<!-- RAG removed from project -->
├── requirements.txt            # Python dependencies
├── detection.py                # Emotion + mental health model inference module
├── Counselor_Llama3_Q4.gguf    # Fine-tuned LLM model file (4.58 GB)
├── Detection/                  # Trained detection models
│   ├── Goemotion-detection/    # DistilBERT GoEmotions model (28 emotions)
│   │   ├── config.json
│   │   ├── model.safetensors
│   │   ├── tokenizer.json
│   │   └── ...
│   ├── Sentimental-analysis/   # RoBERTa mental health classifier (6 classes)
│   │   ├── config.json
│   │   ├── model.safetensors
│   │   ├── label_meta.json
│   │   └── ...
│   └── main.py                 # Original standalone FastAPI server (reference)
├── package.json                # React dependencies
├── vite.config.js              # Vite config with API proxy
├── tailwind.config.js          # Tailwind CSS config
├── index.html                  # React entry HTML
├── asr/                        # ASR streaming server (runs on Google Colab)
│   ├── ASR_Colab_Server.ipynb  # Colab notebook — run this on Colab
│   ├── server_streaming_optimized.py  # FastAPI WebSocket ASR server
│   ├── frequency_dictionary_en_82_765.txt       # SymSpell dictionary
│   └── frequency_bigramdictionary_en_243_342.txt # SymSpell bigrams
├── colab/                      # LLM Colab server
│   └── LLM_Colab_Server.ipynb  # Colab notebook — run LLM on Colab GPU
├── src/                        # React frontend source
│   ├── App.jsx                 # Main app (chat + pipeline integration)
│   ├── main.jsx                # React entry point
│   ├── index.css               # Global styles
│   └── components/
│       ├── ChatInputBar.jsx    # Chat input with voice button
│       ├── VoicePage.jsx       # Voice recording + ASR
│       ├── MentalStatePage.jsx # Emotion/classification results
│       ├── HistoryPage.jsx     # Analysis history
│       ├── FAQsPage.jsx        # FAQs
│       ├── Sidebar.jsx         # Navigation sidebar
│       ├── SentimentGraph.jsx  # Live sentiment trend graph
│       └── SessionSummary.jsx  # End-of-session summary card
└── public/                     # Static assets
```


## Quick Start
## Testing

To run backend Python tests (add your own in the future):

```bash
pytest
```

To run frontend tests (if available):

```bash
npm test
```

## Contribution Guidelines

Contributions are welcome! Please open issues for bugs or feature requests. To contribute code:

1. Fork the repository
2. Create a new branch
3. Make your changes with clear commit messages
4. Submit a pull request

## Security & Privacy

- All user data is processed in-memory and not stored unless explicitly enabled.
- Never hardcode secrets; use environment variables for sensitive information.
- Review third-party dependencies for vulnerabilities regularly.

## Screenshots

Add screenshots or a GIF of the UI here for a quick visual overview.

## Changelog

See CHANGELOG.md for recent updates (if available).

### 1. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 2. Install React dependencies
```bash
npm install
```

### 3. Set up the LLM (Google Colab — recommended)

The 4.58 GB LLM model is best run on Google Colab with a free T4 GPU.

1. Open `colab/LLM_Colab_Server.ipynb` in Google Colab
2. Set runtime to **GPU** (Runtime → Change runtime type → T4 GPU)
3. Upload `Counselor_Llama3_Q4.gguf` when prompted (Cell 2)
4. Paste your ngrok auth token in Cell 3 (get one free at https://dashboard.ngrok.com)
5. Run all cells in order
6. Copy the public ngrok URL from Cell 5 (e.g. `https://xyz.ngrok-free.app`)
7. Set the environment variable before starting the backend:

> **Important:** Use the following value for the LLM API URL:
>
> ```powershell
> $env:LLM_API_URL="https://minh-suberect-preintelligently.ngrok-free.dev"
> ```
>
> Replace this only if you have your own ngrok URL.


**Linux / macOS / Colab:**
```bash
export LLM_API_URL="https://xyz.ngrok-free.app"
```

> **Local mode (16+ GB RAM):** If you have enough RAM, skip Colab. Place `Counselor_Llama3_Q4.gguf` in this directory and do **not** set `LLM_API_URL`. The model will load locally.

### 4. Run both servers

**Terminal 1 — Backend:**
```powershell
$env:LLM_API_URL = "https://xyz.ngrok-free.app"   # your Colab URL
python app.py
```

**Terminal 2 — Frontend:**
```bash
npm run dev
```

Open the URL shown by Vite (usually **http://localhost:5173**).

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/analyze` | POST | Emotion + mental health analysis (existing React API) |
| `/api/chat` | POST | Full pipeline: analysis + LLM counselor response |
| `/api/sentiment` | GET | Sentiment trend data for graph |
| `/api/summary` | POST | End session, get summary |
| `/api/history` | GET | Full chat history |


## ASR & LLM Servers (Google Colab)

- For voice input, run `asr/ASR_Colab_Server.ipynb` in Colab (GPU), upload required files, and use the ngrok URL in the app.
- For LLM, run `colab/LLM_Colab_Server.ipynb` in Colab (GPU), upload the model, and set the LLM_API_URL as above.

**Note:** ngrok URLs change each session. Update the app with the new URL as needed.

---

**Contributions welcome!** For questions or issues, open an issue on GitHub.
