# Mental Health AI Chatbot — Aria

## Project Structure

```
finalized model/
├── app.py                      # Flask API backend (run this first)
├── pipeline.py                 # Full pipeline connecting all components
├── conversation_history.py     # Conversation history manager
├── input_gate.py               # Input gate / filter with 3 crisis levels
├── rag_search.py               # RAG search using sentence-transformers
├── prompt_builder.py           # Prompt builder for Llama 3 instruct
├── llm_responder.py            # LLM response generator (local or remote Colab)
├── safety_guardrails.py        # Post-response safety rules
├── session_summary.py          # Rule-based session summary
├── rag_data.json               # Therapy Q&A pairs for RAG
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
7. Create a `.env` file in the project root and add:

```env
LLM_API_URL=https://xyz.ngrok-free.app
```

> **Local mode (16+ GB RAM):** If you have enough RAM, skip Colab. Place `Counselor_Llama3_Q4.gguf` in this directory and do **not** set `LLM_API_URL`. The model will load locally.

### 4. Run both servers

**Terminal 1 — Backend:**
```powershell
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

## ASR Server (Google Colab)

The Voice Page uses a **Faster Whisper ASR** streaming server that runs on **Google Colab** with GPU acceleration.

### Setup

1. Open `asr/ASR_Colab_Server.ipynb` in Google Colab
2. Set runtime to **GPU** (Runtime → Change runtime type → T4 GPU)
3. Upload the 3 files from `asr/` folder:
   - `server_streaming_optimized.py`
   - `frequency_dictionary_en_82_765.txt`
   - `frequency_bigramdictionary_en_243_342.txt`
4. Run all cells in order
5. Copy the `wss://...ngrok.../ws/asr` URL from Cell 6
6. Paste it into the Voice Page URL input field in the React app
7. Click **Connect Server** and start speaking

> **Note:** The ngrok URL changes each time you restart the Colab notebook. Paste the new URL each session.

## LLM Server (Google Colab)

The counselor LLM (Counselor_Llama3_Q4.gguf, 4.58 GB) runs on **Google Colab** to avoid the 8+ GB RAM needed locally.

### Setup

1. Open `colab/LLM_Colab_Server.ipynb` in Google Colab
2. Set runtime to **GPU** (Runtime → Change runtime type → T4 GPU)
3. Upload `Counselor_Llama3_Q4.gguf` when prompted (Cell 2)
4. Paste your ngrok auth token in Cell 3
5. Run all cells — Cell 4 starts a Flask API and Cell 5 prints the public URL
6. Set `LLM_API_URL` in your `.env` file before running `python app.py`

### API

| Endpoint | Method | Body | Response |
|---|---|---|---|
| `/generate` | POST | `{"prompt": "...", "max_tokens": 300, "temperature": 0.7}` | `{"response": "..."}` |
| `/health` | GET | — | `{"status": "ok"}` |
