# Mental Health AI Chatbot — Aria
## Comprehensive Project Documentation

---

# Table of Contents

1. [Project Overview](#1-project-overview)
2. [Project Structure](#2-project-structure)
3. [File-by-File Explanation](#3-file-by-file-explanation)
4. [Technologies Used](#4-technologies-used)
5. [Key Features Implemented](#5-key-features-implemented)
6. [Development Steps / What We Built](#6-development-steps--what-we-built)
7. [System Flow](#7-system-flow)
8. [Setup and Running Instructions](#8-setup-and-running-instructions)
9. [Future Improvements](#9-future-improvements)

---

# 1. Project Overview

## What is Aria?

**Aria** is an AI-powered mental health support chatbot that provides empathetic, therapist-like conversations to users seeking emotional support. The system combines **Natural Language Processing (NLP)**, **deep learning models**, and a **modern web interface** to create a comprehensive mental health assistance platform.

## Main Goal

The project aims to provide accessible, 24/7 mental health support by:

- **Detecting user emotions** in real-time using a fine-tuned DistilBERT model (GoEmotions — 28 emotions)
- **Classifying mental health states** using a fine-tuned RoBERTa model (6 categories: Anxiety, Bipolar, Depression, Normal, Personality Disorder, Suicidal)
- **Generating empathetic counselor responses** using a fine-tuned Llama 3 language model (Counselor_Llama3_Q4.gguf)
- **Providing real-time speech input** via a Faster Whisper ASR streaming server
- **Tracking emotional trends** through sentiment graphs across the conversation
- **Ensuring safety** through crisis detection, input filtering, and post-response safety guardrails

## How It Works (High Level)

```
User Input (Text or Voice)
        ↓
  Input Gate (Filter)
        ↓
  Emotion Detection (GoEmotions DistilBERT)
        ↓
  Mental Health Classification (RoBERTa)
        ↓
  RAG Search (find similar therapy Q&A)
        ↓
  Prompt Builder (Llama 3 instruct format)
        ↓
  LLM Response Generator (Counselor Llama 3)
        ↓
  Safety Guardrails (post-processing)
        ↓
  Response displayed to user with emotion tags
```

---

# 2. Project Structure

```
finalized model/
│
├── app.py                        # Flask API backend (main server entry point)
├── pipeline.py                   # 9-step processing pipeline connecting all components
├── conversation_history.py       # Conversation history manager with token budgeting
├── input_gate.py                 # Input filter with 3-level crisis detection
├── rag_search.py                 # RAG search using sentence-transformers
├── rag_data.json                 # 126 curated therapy Q&A pairs for RAG
├── prompt_builder.py             # Llama 3 instruct prompt formatter
├── llm_responder.py              # LLM response generator (local or remote Colab)
├── safety_guardrails.py          # Post-response safety rules
├── session_summary.py            # Rule-based session summary generator
├── detection.py                  # Emotion + mental health model inference module
├── requirements.txt              # Python dependencies
├── Counselor_Llama3_Q4.gguf      # Fine-tuned Llama 3 model file (4.58 GB)
├── README.md                     # Project readme
│
├── Detection/                    # Pre-trained detection models
│   ├── Goemotion-detection/      # DistilBERT GoEmotions model (28 emotions)
│   │   ├── config.json           # Model configuration
│   │   ├── model.safetensors     # Model weights
│   │   ├── tokenizer.json        # Tokenizer data
│   │   ├── tokenizer_config.json # Tokenizer configuration
│   │   ├── vocab.txt             # Vocabulary file
│   │   ├── pytorch_model.bin     # PyTorch model weights
│   │   ├── model_go_pruned.pt    # Pruned model variant
│   │   └── training_args.bin     # Training arguments
│   ├── Sentimental-analysis/     # RoBERTa mental health classifier (6 classes)
│   │   ├── config.json           # Model configuration
│   │   ├── model.safetensors     # Model weights
│   │   ├── tokenizer.json        # Tokenizer data
│   │   ├── tokenizer_config.json # Tokenizer configuration
│   │   ├── vocab.json            # Vocabulary mapping
│   │   ├── merges.txt            # BPE merges
│   │   └── label_meta.json       # Class labels metadata
│   ├── main.py                   # Original standalone FastAPI server (reference)
│   └── Frontend/
│       └── analysis.html         # Original standalone analysis frontend
│
├── asr/                          # ASR streaming server (Google Colab)
│   ├── ASR_Colab_Server.ipynb    # Colab notebook for running ASR
│   ├── server_streaming_optimized.py  # FastAPI WebSocket ASR server
│   ├── frequency_dictionary_en_82_765.txt        # SymSpell dictionary
│   └── frequency_bigramdictionary_en_243_342.txt  # SymSpell bigrams
│
├── colab/                        # LLM Colab server
│   └── LLM_Colab_Server.ipynb   # Colab notebook for running LLM on GPU
│
├── src/                          # React frontend source code
│   ├── App.jsx                   # Main app component (chat UI + pipeline integration)
│   ├── main.jsx                  # React entry point
│   ├── index.css                 # Global styles and custom animations
│   ├── assets/                   # Static assets
│   │   ├── logo.png              # Application logo
│   │   └── react.svg             # React logo
│   └── components/
│       ├── Sidebar.jsx           # Navigation sidebar with animated icons
│       ├── ChatInputBar.jsx      # Chat input with send and voice buttons
│       ├── VoicePage.jsx         # Voice recording + ASR WebSocket streaming
│       ├── MentalStatePage.jsx   # Emotion/classification results display
│       ├── HistoryPage.jsx       # Analysis history with pagination
│       ├── FAQsPage.jsx          # Frequently asked questions accordion
│       ├── SentimentGraph.jsx    # Canvas-based sentiment trend graph
│       └── SessionSummary.jsx    # End-of-session summary card
│
├── index.html                    # HTML entry point for React
├── package.json                  # Node.js dependencies
├── vite.config.js                # Vite config with API proxy
├── tailwind.config.js            # Tailwind CSS configuration
├── postcss.config.cjs            # PostCSS configuration
├── eslint.config.js              # ESLint configuration
├── .gitignore                    # Git ignore rules
└── .venv/                        # Python virtual environment
```

---

# 3. File-by-File Explanation

## 3.1 Backend Python Files

### 3.1.1 `app.py` — Flask API Backend

- **Path:** `finalized model/app.py`
- **Purpose:** Main server entry point. Provides REST API endpoints that connect the React frontend to the processing pipeline.
- **Port:** 8000

**Key Endpoints:**

| Endpoint | Method | Purpose |
|---|---|---|
| `/analyze` | POST | Emotion + mental health analysis (returns detection results only) |
| `/api/chat` | POST | Full pipeline: analysis + LLM counselor response |
| `/api/sentiment` | GET | Sentiment trend data for the graph component |
| `/api/summary` | POST | End session and generate summary |
| `/api/history` | GET | Full conversation history |

**Key Functions:**
- `get_session(session_id)` — Creates or retrieves a ConversationHistory instance for a given session
- `analyze()` — Calls `analyze_full()` from detection.py for emotion + mental health classification
- `chat()` — Calls `process_user_input()` from pipeline.py for the full 9-step processing
- `summary()` — Calls `end_session()` from pipeline.py, then clears the session

**Interactions:**
- Imports from `pipeline.py`, `detection.py`, `conversation_history.py`
- Called by the React frontend via HTTP requests (proxied through Vite)

---

### 3.1.2 `pipeline.py` — Full Processing Pipeline

- **Path:** `finalized model/pipeline.py`
- **Purpose:** The core engine. Connects all 9 components in the correct processing order.

**The 9-Step Pipeline:**

```
Step 1: Input Gate        → check_input() from input_gate.py
Step 2: Emotion Detection → detect_emotion() from detection.py
Step 3: Mental Health     → classify_mental_health() from detection.py
Step 4: Conversation Hist → add_user_message() on ConversationHistory
Step 5: RAG Search        → get_rag_example() from rag_search.py
Step 6: Prompt Builder    → build_prompt() from prompt_builder.py
Step 7: LLM Response      → generate_response() from llm_responder.py
Step 8: Safety Guardrails → apply_safety_guardrails() from safety_guardrails.py
Step 9: Return Result     → dict with response, emotion, category, scores
```

**Key Functions:**
- `process_user_input(user_message, conversation_history)` — Main pipeline function
- `end_session(conversation_history)` — Generates session summary
- `_get_rag_search()` — Lazy-loads RAG search module (avoids slow startup)
- `_get_llm_responder()` — Lazy-loads LLM responder (only initialized on first chat)

**Design Decision — Lazy Loading:**
RAG search and LLM responder are loaded lazily (on first use) rather than at import time. This keeps the server startup fast and avoids loading heavy models until they're actually needed.

---

### 3.1.3 `conversation_history.py` — Conversation History Manager

- **Path:** `finalized model/conversation_history.py`
- **Purpose:** Manages the chat history between user and AI counselor. Stores messages with emotion/category metadata.

**Key Class: `ConversationHistory`**

| Method | Purpose |
|---|---|
| `add_user_message(content, emotion, score, category, cat_score)` | Adds user message with analysis data |
| `add_assistant_message(content)` | Adds bot response |
| `get_last_n(n=8)` | Returns last N messages |
| `get_safe_history(max_tokens=1500)` | Returns history within token budget |
| `get_score_history()` | Returns emotion/category scores for the sentiment graph |
| `get_all()` | Returns complete history |
| `clear()` | Clears all messages |

**Token Budgeting:** The `get_safe_history()` method ensures the history passed to the LLM never exceeds 1500 estimated tokens (word_count × 1.3). It trims oldest messages first while always keeping at least 2 messages.

---

### 3.1.4 `input_gate.py` — Input Gate / Filter

- **Path:** `finalized model/input_gate.py`
- **Purpose:** First line of defense. Checks every user message before it reaches the AI models. Provides immediate responses for greetings, crisis messages, and too-short inputs.

**3-Level Crisis Detection System:**

| Level | Keywords | Response |
|---|---|---|
| Crisis Level 3 (Critical) | "suicide", "kill myself", "end my life" | Immediate crisis hotline (988) referral |
| Crisis Level 2 (Severe) | "can't take this", "breaking down", "falling apart" | Deep breath + grounding exercise offer |
| Crisis Level 1 (Mild) | "hopeless", "alone", "feel worthless" | Empathetic acknowledgment + ask more |

**Key Function: `check_input(user_message)`**
- Returns `{"status": "proceed", "response": None}` for genuine messages
- Returns fixed responses for greetings, crisis, or too-short inputs
- Messages with fewer than 3 words that aren't greetings are filtered as "too short"

---

### 3.1.5 `rag_search.py` — RAG Search Module

- **Path:** `finalized model/rag_search.py`
- **Purpose:** Retrieval-Augmented Generation (RAG) — finds the most relevant therapy Q&A example to guide the LLM's response.

**How It Works:**
1. At startup, loads 126 curated Q&A pairs from `rag_data.json`
2. Pre-computes vector embeddings for all 126 questions using `all-MiniLM-L6-v2`
3. When a user sends a message, computes its embedding
4. Finds the most similar question using cosine similarity
5. Returns the matched Q&A pair to be injected into the LLM prompt

**Key Class: `RAGSearch`**

| Method | Purpose |
|---|---|
| `__init__()` | Loads model + JSON data, pre-computes all embeddings |
| `get_rag_example(user_message)` | Returns best-matching `{question, answer, similarity_score}` |

**Why RAG Matters:** Without RAG, the LLM relies purely on its training data. With RAG, it gets a relevant therapy example as a reference, improving response quality and alignment with professional therapeutic techniques.

---

### 3.1.6 `rag_data.json` — Therapy Q&A Database

- **Path:** `finalized model/rag_data.json`
- **Purpose:** Contains 126 curated question-answer pairs covering various mental health topics.

**Topics Covered:**
- Anxiety & stress management
- Depression & sadness
- Relationship conflicts
- Work-life balance
- Self-esteem & confidence
- Grief & loss
- Sleep issues
- Anger management
- Social anxiety
- Family dynamics

**Format:**
```json
[
  {
    "question": "I feel anxious all the time but I don't know why",
    "answer": "It's completely understandable to feel that way. Anxiety can sometimes appear without a clear trigger. Let's explore what might be contributing to these feelings. Have you noticed any patterns in when the anxiety feels strongest?"
  },
  ...
]
```

**Average answer length:** 37 words (2-4 sentences) — designed to be concise and conversational.

---

### 3.1.7 `prompt_builder.py` — Prompt Builder

- **Path:** `finalized model/prompt_builder.py`
- **Purpose:** Combines all context (user message, emotion, category, RAG example, conversation history) into a structured prompt formatted for the Llama 3 instruct model.

**System Prompt (defines Aria's personality):**
```
You are an empathetic mental health counselor named Aria.
You chat naturally like a caring friend — keep replies SHORT (1 to 3 sentences).
Match the length of the user's message: short input = short reply.
Ask ONE follow-up question to keep the conversation going.
Never write long paragraphs or lists. Never repeat what the user said.
Never diagnose or prescribe medication.
Recommend professional help only for serious concerns.
```

**Prompt Structure (Llama 3 Instruct Format):**
```
<|begin_of_text|><|start_header_id|>system<|end_header_id|>
{system_prompt}<|eot_id|>
<|start_header_id|>user<|end_header_id|>
CONTEXT FROM ANALYSIS:
Detected Emotion: {emotion} (confidence: {pct}%)
Mental Health Category: {category} (confidence: {pct}%)

REFERENCE EXAMPLE FROM THERAPY DATABASE:
Similar question: {rag_question}
Example response: {rag_answer}

CONVERSATION HISTORY (last messages):
User: ...
Assistant: ...

USER MESSAGE:
{user_message}

Respond as the counselor:<|eot_id|>
<|start_header_id|>assistant<|end_header_id|>
```

**Key Function: `build_prompt(...)`** — Takes 7 parameters and returns the fully formatted prompt string.

---

### 3.1.8 `llm_responder.py` — LLM Response Generator

- **Path:** `finalized model/llm_responder.py`
- **Purpose:** Generates counselor-like responses. Supports two modes:

**Mode 1 — Remote (Recommended):**
- Set `LLM_API_URL` environment variable to the Colab ngrok URL
- Sends prompts to the LLM running on Google Colab via HTTP POST
- No model loaded locally — saves RAM

**Mode 2 — Local:**
- Loads `Counselor_Llama3_Q4.gguf` (4.58 GB) locally using `llama-cpp-python`
- Requires 16+ GB RAM
- Uses GPU if available (`n_gpu_layers=-1`)

**Key Class: `LLMResponder`**

| Method | Purpose |
|---|---|
| `__init__(model_path)` | Detects mode from env var, loads model if local |
| `generate_response(prompt)` | Routes to local or remote generation |
| `_generate_local(prompt)` | Uses local Llama model with max_tokens=120 |
| `_generate_remote(prompt)` | HTTP POST to Colab API with max_tokens=120 |

**Parameters:** `max_tokens=120`, `temperature=0.7`, stop tokens: `["User:", "Human:", "<|eot_id|>"]`

---

### 3.1.9 `safety_guardrails.py` — Safety Guardrails

- **Path:** `finalized model/safety_guardrails.py`
- **Purpose:** Post-processing rules applied AFTER the LLM generates a response. Ensures output is safe, ethical, and appropriate.

**4 Safety Rules:**

| Rule | Trigger | Action |
|---|---|---|
| No Diagnosis | Response contains "you have", "you suffer from", etc. | Removes diagnostic sentence, adds professional help suggestion |
| Low Confidence | Emotion or category score < 0.5 | Appends "I want to make sure I understand you correctly..." |
| Response Too Short | Response has < 20 words | Appends "Can you share more about what you're going through?" |
| Safe Closing | Category score > 0.85 | Appends recommendation to speak with a licensed professional |

**Key Function: `apply_safety_guardrails(response, emotion_score, category_score)`**

---

### 3.1.10 `session_summary.py` — Session Summary Generator

- **Path:** `finalized model/session_summary.py`
- **Purpose:** Generates a rule-based summary when the user clicks "End Session". Uses data collected during the conversation — no LLM inference needed.

**Summary Data Generated:**

| Field | How It's Computed |
|---|---|
| `primary_emotion` | Most frequent emotion across all messages (Counter) |
| `primary_category` | Most frequent mental health category |
| `trend` | Compares first vs last emotion_score: Improved / Worsened / Stable |
| `start_score` | First message's emotion score |
| `end_score` | Last message's emotion score |
| `recommendation` | Based on final category_score threshold |
| `message_count` | Total user messages in the session |
| `summary_text` | Formatted text summary string |

---

### 3.1.11 `detection.py` — Detection Module

- **Path:** `finalized model/detection.py`
- **Purpose:** Loads and runs inference on both pre-trained detection models.

**Two Models:**

**1. GoEmotions Model (Emotion Detection)**
- Architecture: DistilBERT fine-tuned on Google's GoEmotions dataset
- Path: `Detection/Goemotion-detection/`
- Output: 28 emotion labels (admiration, amusement, anger, anxiety, caring, confusion, curiosity, disappointment, disgust, embarrassment, excitement, fear, gratitude, grief, joy, love, nervousness, optimism, pride, realization, relief, remorse, sadness, surprise, neutral, etc.)
- Inference: Uses last 2 sentences of input for focused emotion detection

**2. Sentimental-Analysis Model (Mental Health Classification)**
- Architecture: RoBERTa fine-tuned for mental health text classification
- Path: `Detection/Sentimental-analysis/`
- Output: 6 classes — Anxiety, Bipolar, Depression, Normal, Personality Disorder, Suicidal
- Inference: Sliding window chunking (256 tokens, stride 64) for long texts

**Key Functions:**

| Function | Purpose |
|---|---|
| `detect_emotion(text)` | Returns `(emotion_label, confidence)` |
| `classify_mental_health(text)` | Returns `(category_label, confidence)` |
| `analyze_full(text)` | Returns full analysis dict for `/analyze` endpoint |
| `clean(text)` | Removes fillers, URLs, excessive punctuation |

**Additional Features:**
- **Lazy loading** — models loaded on first use
- **Text cleaning** — removes filler words ("you know", "basically", "literally")
- **Chunking** — handles long texts by splitting into overlapping chunks
- **Suicidal detection** — if classified as "Suicidal", skips emotion detection and flags high_risk

---

### 3.1.12 `requirements.txt` — Python Dependencies

- **Path:** `finalized model/requirements.txt`
- **Contents:**

```
flask==3.1.0
flask-cors==5.0.1
sentence-transformers==3.4.1
llama-cpp-python==0.3.8
numpy>=1.24.0
torch>=2.0.0
transformers>=4.36.0
PyPDF2>=3.0.0
```

---

## 3.2 Frontend React Files

### 3.2.1 `src/App.jsx` — Main Application Component

- **Path:** `finalized model/src/App.jsx`
- **Purpose:** The root React component. Manages chat state, page routing, API calls, and renders the main chat interface.
- **Lines:** ~400

**Key State Variables:**
- `messages` — Array of chat messages `{text, sender, tags}`
- `currentPage` — Current active page (home, voice, mental-state, history, faqs)
- `sessionId` — Unique session identifier (generated from timestamp)
- `sentimentData` — Array of sentiment scores for the graph
- `sessionSummary` — Session summary data (when session ends)

**Key Functions:**
- `analyzeText(text)` — Two-step API call: first `/analyze` for detection, then `/api/chat` for full pipeline response
- `fetchSentiment()` — Fetches sentiment trend data from `/api/sentiment`
- `handleEndSession()` — Calls `/api/summary` and displays summary card
- `sendMessage()` — Sends user message through the pipeline

**Page Routing:**
The app uses simple state-based routing (`currentPage`) instead of React Router:
- `home` → Chat interface with sentiment graph
- `voice` → VoicePage component
- `mental-state` → MentalStatePage component
- `history` → HistoryPage component
- `faqs` → FAQsPage component

**UI Features:**
- Animated starfield background (80 floating dots)
- Typing indicator with bouncing dots
- Analyzing indicator with colored dots
- Gradient message bubbles (purple for user, glass-morphism for bot)
- Emotion/category tags displayed below bot messages

---

### 3.2.2 `src/components/Sidebar.jsx` — Navigation Sidebar

- **Path:** `finalized model/src/components/Sidebar.jsx`
- **Purpose:** Navigation menu with animated glass-morphism buttons.
- **Lines:** 124

**Navigation Items:**
| Icon | Label | Page |
|---|---|---|
| Home | Home | Chat interface |
| Activity | Mental State | Latest analysis results |
| Clock | History | Past analysis history |
| HelpCircle | FAQs | Frequently asked questions |

**Features:** Active state highlighting, icon hover glow effects, logo animation

---

### 3.2.3 `src/components/ChatInputBar.jsx` — Chat Input Component

- **Path:** `finalized model/src/components/ChatInputBar.jsx`
- **Purpose:** Text input field with send, voice, and refresh buttons.
- **Lines:** 80

**Features:**
- Enter key sends message
- Microphone button switches to Voice Page
- Refresh button reloads the page
- Purple gradient styling

---

### 3.2.4 `src/components/VoicePage.jsx` — Voice Recording Interface

- **Path:** `finalized model/src/components/VoicePage.jsx`
- **Purpose:** Full voice recording interface with real-time WebSocket streaming to the ASR server.
- **Lines:** ~450

**How Voice Input Works:**
1. User enters their ASR WebSocket URL (from Colab) and clicks "Connect Server"
2. URL is saved to `localStorage` for persistence
3. On "Start Recording", browser captures microphone audio
4. Raw audio is converted from Float32 to PCM16 format
5. PCM16 chunks are streamed via WebSocket to the ASR server
6. Server returns partial and final transcriptions in real-time
7. On "Stop Recording", a flush command is sent
8. Final transcribed text is sent to `/analyze` API for emotion analysis

**Key Technical Details:**
- Audio: Echo cancellation + noise suppression enabled
- Format: PCM16 at 16kHz sample rate
- WebSocket: Binary frames for audio, JSON for control messages
- Dual buffer: Accumulated text (finalized) + partial text (in-progress)
- 3-second flush timeout after recording stops

---

### 3.2.5 `src/components/MentalStatePage.jsx` — Analysis Results

- **Path:** `finalized model/src/components/MentalStatePage.jsx`
- **Purpose:** Displays the latest emotion detection and mental health classification results.
- **Lines:** 280

**Displays:**
- Detected emotion with confidence percentage and color coding
- Mental health classification with confidence percentage
- User's original text
- Recent analysis history (last few entries)
- Color-coded emotion categories (green for positive, red for negative, etc.)

---

### 3.2.6 `src/components/HistoryPage.jsx` — Analysis History

- **Path:** `finalized model/src/components/HistoryPage.jsx`
- **Purpose:** Paginated list of all past analyses with timestamps, emotions, and mental states.
- **Lines:** 220

**Features:**
- Reverse chronological order (newest first)
- Relative timestamps ("5 mins ago", "2 days ago")
- Clear history with confirmation modal
- Color-coded labels for emotions and mental states

---

### 3.2.7 `src/components/FAQsPage.jsx` — FAQ Section

- **Path:** `finalized model/src/components/FAQsPage.jsx`
- **Purpose:** Accordion-style FAQ covering app functionality, privacy, and safety.
- **Lines:** 210

**FAQ Topics (10 questions):**
- What is this AI assistant?
- How does speech recognition work? (Whisper, 95-98% accuracy)
- How does emotion detection work? (GoEmotions + BERT, 28 emotions)
- Is my data private? (localStorage only)
- Can this replace professional therapy?
- Crisis resources (988 Suicide and Crisis Lifeline)
- And more...

---

### 3.2.8 `src/components/SentimentGraph.jsx` — Sentiment Trend Chart

- **Path:** `finalized model/src/components/SentimentGraph.jsx`
- **Purpose:** Custom canvas-based dual-line chart showing emotion and mental health score trends over messages.
- **Lines:** 95

**Chart Details:**
- X-axis: Message number
- Y-axis: Score percentage (0-100%)
- Purple line: Emotion detection score
- Blue line: Mental health category score
- Grid lines for readability
- Updates in real-time after each message

---

### 3.2.9 `src/components/SessionSummary.jsx` — Session Summary Card

- **Path:** `finalized model/src/components/SessionSummary.jsx`
- **Purpose:** Displays end-of-session summary with statistics and recommendations.
- **Lines:** 65

**Summary Card Shows:**
- Total message count
- Emotional trend (📉 Improved / 📈 Worsened / ➡️ Stable)
- Primary emotion detected
- Primary mental health concern
- Starting vs ending distress scores
- Personalized recommendation
- "Start New Session" button

---

### 3.2.10 `src/main.jsx` — React Entry Point

- **Path:** `finalized model/src/main.jsx`
- **Purpose:** Bootstraps the React application.
- **Lines:** 8

```jsx
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

---

### 3.2.11 `src/index.css` — Global Styles

- **Path:** `finalized model/src/index.css`
- **Purpose:** Tailwind directives + custom CSS animations.
- **Lines:** 85

**Custom Animations Defined:**
- `animate-float` — Vertical floating motion (sidebar buttons)
- `animate-twinkle` — Shimmer/scale effect (icons)
- `animate-logoGlow` — Drop shadow glow (logo)
- `animate-fadeIn` — Opacity + translate entrance (messages)
- `animate-slideUp` — Slide up entrance (bot messages)
- `animate-bounce` — Dot bounce (typing indicator)

---

## 3.3 Configuration Files

### 3.3.1 `vite.config.js`

- **Purpose:** Vite build configuration with React plugin and API proxy.
- Proxies `/analyze` and `/api/*` requests to `http://127.0.0.1:8000` (Flask backend)

### 3.3.2 `package.json`

- **Purpose:** Node.js project definition.
- **Scripts:** `dev` (Vite dev server), `build` (production build), `lint`, `preview`
- **Key deps:** React 19, lucide-react, react-icons

### 3.3.3 `tailwind.config.js`

- **Purpose:** Tailwind CSS configuration scanning all JSX/TSX files.

### 3.3.4 `index.html`

- **Purpose:** HTML entry point with `<div id="root">` mount point.

### 3.3.5 `.gitignore`

- **Purpose:** Ignores `.venv/`, `node_modules/`, `__pycache__/`, `*.gguf`, `.ipynb_checkpoints/`

---

## 3.4 ASR Server Files

### 3.4.1 `asr/server_streaming_optimized.py`

- **Purpose:** FastAPI WebSocket server for real-time speech-to-text.
- **Runs on:** Google Colab (with GPU)

**Technologies Used:**
- **Faster Whisper** (medium model) — Speech-to-text transcription
- **Silero VAD** — Voice Activity Detection (detects when user stops speaking)
- **SymSpell** — Spell correction for transcription accuracy
- **Levenshtein** — String distance for partial text change detection

**Configuration:**
- Sample rate: 16kHz
- VAD threshold: 0.5
- Min silence duration: 1.5 seconds
- Context window: 2.0 seconds
- Max buffer: 120 seconds (2 minutes)

### 3.4.2 `asr/ASR_Colab_Server.ipynb`

- **Purpose:** Google Colab notebook to run the ASR server with GPU acceleration and ngrok tunnel.

### 3.4.3 Dictionary Files

- `frequency_dictionary_en_82_765.txt` — SymSpell unigram dictionary (82,765 entries)
- `frequency_bigramdictionary_en_243_342.txt` — SymSpell bigram dictionary (243,342 entries)

---

## 3.5 LLM Colab Server

### 3.5.1 `colab/LLM_Colab_Server.ipynb`

- **Purpose:** Google Colab notebook that loads the 4.58 GB GGUF model on a T4 GPU and exposes a Flask API.

**Cells:**
1. Install dependencies (llama-cpp-python GPU wheel, flask, pyngrok)
2. Mount Google Drive and copy model file
3. Configure ngrok authentication
4. Load model on GPU + start Flask API on port 5000
5. Create ngrok tunnel and display public URL
6. Keep-alive loop

**API Endpoints:**
- `POST /generate` — `{"prompt": "...", "max_tokens": 120}` → `{"response": "..."}`
- `GET /health` — `{"status": "ok", "model": "Counselor_Llama3_Q4", "gpu": true}`

---

## 3.6 Detection Model Files

### 3.6.1 `Detection/Goemotion-detection/`

Pre-trained DistilBERT model fine-tuned on Google's GoEmotions dataset.

| File | Purpose |
|---|---|
| `config.json` | Model architecture configuration (hidden size, layers, etc.) |
| `model.safetensors` | Model weights in safetensors format |
| `pytorch_model.bin` | Model weights in PyTorch format |
| `model_go_pruned.pt` | Pruned variant of the model |
| `tokenizer.json` | Fast tokenizer data |
| `tokenizer_config.json` | Tokenizer settings |
| `vocab.txt` | BERT vocabulary (30,522 tokens) |
| `training_args.bin` | Training hyperparameters |

### 3.6.2 `Detection/Sentimental-analysis/`

Pre-trained RoBERTa model fine-tuned for mental health text classification.

| File | Purpose |
|---|---|
| `config.json` | Model architecture configuration |
| `model.safetensors` | Model weights |
| `tokenizer.json` | Fast tokenizer data |
| `tokenizer_config.json` | Tokenizer settings |
| `vocab.json` | RoBERTa vocabulary |
| `merges.txt` | BPE merge operations |
| `label_meta.json` | Class labels: Anxiety, Bipolar, Depression, Normal, Personality Disorder, Suicidal |

---

# 4. Technologies Used

## 4.1 Programming Languages

| Language | Usage |
|---|---|
| **Python 3.11** | Backend server, ML model inference, pipeline logic |
| **JavaScript (JSX)** | React frontend components |
| **HTML/CSS** | Web interface, Tailwind utility classes |

## 4.2 Backend Frameworks & Libraries

| Library | Version | Role |
|---|---|---|
| **Flask** | 3.1.0 | REST API web server |
| **Flask-CORS** | 5.0.1 | Cross-Origin Resource Sharing for frontend-backend communication |
| **PyTorch** | ≥2.0.0 | Deep learning framework for running DistilBERT and RoBERTa models |
| **Transformers** (HuggingFace) | ≥4.36.0 | Model loading (AutoTokenizer, AutoModelForSequenceClassification) |
| **sentence-transformers** | 3.4.1 | RAG embedding model (all-MiniLM-L6-v2) |
| **llama-cpp-python** | 0.3.8 | Local GGUF model loading and inference (used in local mode) |
| **NumPy** | ≥1.24.0 | Array operations for model inference |

## 4.3 Frontend Frameworks & Libraries

| Library | Version | Role |
|---|---|---|
| **React** | 19.2.0 | UI component framework |
| **Vite** | 7.3.1 | Build tool and dev server with HMR |
| **Tailwind CSS** | 3.3.3 | Utility-first CSS styling |
| **lucide-react** | 0.564.0 | Sidebar navigation icons |
| **react-icons** | 5.5.0 | Chat input bar and page icons |

## 4.4 AI/ML Models

| Model | Architecture | Purpose | Size |
|---|---|---|---|
| **Counselor Llama 3 Q4** | Llama 3 (quantized Q4) | Counselor response generation | 4.58 GB |
| **GoEmotions** | DistilBERT | Emotion detection (28 emotions) | ~260 MB |
| **Sentimental-Analysis** | RoBERTa | Mental health classification (6 classes) | ~500 MB |
| **all-MiniLM-L6-v2** | MiniLM | RAG sentence embeddings | ~80 MB |
| **Faster Whisper** (medium) | Whisper | Speech-to-text (ASR) | ~1.5 GB |
| **Silero VAD** | Custom | Voice Activity Detection | ~2 MB |

## 4.5 Infrastructure & Tools

| Tool | Purpose |
|---|---|
| **Google Colab** | GPU runtime for LLM and ASR servers (T4 GPU) |
| **ngrok** | Tunnel Colab servers to public URLs |
| **Google Drive** | Host the 4.58 GB GGUF model file for Colab |
| **SymSpell** | Spelling correction for ASR transcriptions |
| **WebSocket** | Real-time audio streaming for voice input |
| **localStorage** | Client-side storage for analysis history |

---

# 5. Key Features Implemented

## 5.1 Multi-Model Emotion Analysis

The system uses **two separate deep learning models** running simultaneously:

- **GoEmotions (DistilBERT)** detects 28 fine-grained emotions like admiration, anger, caring, confusion, excitement, gratitude, grief, nervousness, sadness, and more.
- **RoBERTa classifier** categorizes mental health state into 6 classes: Anxiety, Bipolar, Depression, Normal, Personality Disorder, and Suicidal.

Both models run locally on CPU, use lazy loading (loaded only on first request), and include text cleaning to remove filler words.

## 5.2 9-Step Processing Pipeline

Every user message passes through a 9-step pipeline:
1. **Input Gate** — Filters greetings, crisis messages, too-short inputs
2. **Emotion Detection** — 28-class emotion classification
3. **Mental Health Classification** — 6-class mental health assessment
4. **Conversation History** — Stores message with scores
5. **RAG Search** — Finds similar therapy Q&A from 126 curated pairs
6. **Prompt Building** — Constructs Llama 3 instruct-format prompt
7. **LLM Response** — Generates counselor response (local or Colab)
8. **Safety Guardrails** — Post-processes for safety
9. **Result Return** — Sends response + analysis data to frontend

## 5.3 3-Level Crisis Detection

The input gate implements three severity levels of crisis detection:
- **Level 1 (Mild):** Acknowledges feelings, asks for more information
- **Level 2 (Severe):** Offers grounding exercises, breathing techniques
- **Level 3 (Critical):** Immediately provides 988 Suicide & Crisis Lifeline contact

## 5.4 Retrieval-Augmented Generation (RAG)

Uses `all-MiniLM-L6-v2` to find the most similar question from 126 curated therapy Q&A pairs. The matched answer is injected into the prompt as a reference example, guiding the LLM to produce more therapeutic and relevant responses.

## 5.5 Real-Time Speech-to-Text (ASR)

WebSocket-based streaming ASR using Faster Whisper on Google Colab:
- Real-time transcription as the user speaks
- Voice Activity Detection (Silero VAD) for silence handling
- Spell correction (SymSpell) for improved accuracy
- Configurable server URL (saved to localStorage)

## 5.6 Live Sentiment Tracking

A canvas-based dual-line chart that updates after every message, showing:
- Emotion detection confidence over time
- Mental health classification confidence over time
- Visual trends help users understand their emotional patterns

## 5.7 Session Summary

When the user clicks "End Session", the system generates a summary with:
- Most frequent emotion and mental health category
- Emotional trend (Improved / Worsened / Stable)
- Starting vs ending distress levels
- Personalized recommendation

## 5.8 Post-Response Safety Guardrails

Four safety rules applied after every LLM response:
1. Detects and removes diagnostic language
2. Handles low-confidence detections gracefully
3. Ensures responses aren't too short
4. Adds professional help recommendations for high-confidence mental health detections

## 5.9 Remote LLM Execution

Due to the 4.58 GB model size requiring 8+ GB RAM, the LLM runs on Google Colab with a T4 GPU. The backend communicates via HTTP through an ngrok tunnel. This is transparent to the user.

---

# 6. Development Steps / What We Built

## Phase 1: Core Backend Architecture

**What was built first:**
1. `conversation_history.py` — Message storage with token budgeting
2. `rag_search.py` + `rag_data.json` — RAG search engine with 126 Q&A pairs
3. `input_gate.py` — 3-level crisis detection system
4. `prompt_builder.py` — Llama 3 instruct-format prompt constructor
5. `llm_responder.py` — LLM response generator
6. `safety_guardrails.py` — 4 post-processing safety rules
7. `session_summary.py` — Rule-based session summary
8. `pipeline.py` — 9-step pipeline connecting everything
9. `app.py` — Flask REST API server

## Phase 2: React Frontend Integration

**Features added:**
- Cloned existing React frontend from GitHub repository
- Updated `App.jsx` to call both `/analyze` and `/api/chat` endpoints
- Created `SentimentGraph.jsx` — Canvas-based live sentiment chart
- Created `SessionSummary.jsx` — End-of-session summary card
- Configured Vite proxy for API requests

## Phase 3: ASR (Speech-to-Text) Integration

**Features added:**
- Created `asr/` directory with Colab notebook and server script
- Updated `VoicePage.jsx` with configurable WebSocket URL
- Added PCM16 audio streaming with echo/noise cancellation
- Integrated SymSpell dictionaries for spell correction

## Phase 4: Detection Model Integration

**Major change:**
- Created `detection.py` — unified inference module
- Replaced stub functions in `pipeline.py` with real model imports
- Integrated GoEmotions (DistilBERT) for 28-emotion detection
- Integrated RoBERTa for 6-class mental health classification
- Added text cleaning, chunking, and suicidal detection

## Phase 5: Dependency Resolution

**Issues solved:**
- Installed all Python dependencies in virtual environment
- Resolved `llama-cpp-python` installation on Windows (prebuilt CPU wheel)
- Fixed module import paths

## Phase 6: Hardware Optimization

**Problem:** 4.58 GB LLM + detection models + OS ≈ 8.25 GB → exceeded 8 GB RAM
**Solution:**
- Created `colab/LLM_Colab_Server.ipynb` to run LLM on Google Colab
- Updated `llm_responder.py` to support remote mode via `LLM_API_URL` env var
- Google Drive mounting for reliable model file transfer (instead of direct upload)

## Phase 7: Response Quality Tuning

**Improvements:**
- Reduced `max_tokens` from 300 → 120 to prevent overly long responses
- Rewrote system prompt for natural, conversational tone
- Added instructions: "Match the length of the user's message"

---

# 7. System Flow

## 7.1 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE (React)                     │
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │ Text Chat │    │  Voice Page  │    │  Mental State Page │  │
│  │ (App.jsx) │    │(VoicePage.jsx│    │(MentalStatePage)  │  │
│  └────┬─────┘    └──────┬───────┘    └───────────────────┘  │
│       │                 │                                     │
│       │    ┌────────────┘                                     │
│       │    │ WebSocket (PCM16 audio)                         │
│       │    ▼                                                  │
│       │  ┌──────────────────────┐                            │
│       │  │  ASR Colab Server    │                            │
│       │  │  (Faster Whisper)    │                            │
│       │  │  Returns: text       │                            │
│       │  └──────────┬───────────┘                            │
│       │             │ transcribed text                        │
│       ▼             ▼                                         │
│  ┌─────────────────────────────────────┐                     │
│  │  POST /analyze  +  POST /api/chat   │                     │
│  └─────────────────┬───────────────────┘                     │
└────────────────────┼─────────────────────────────────────────┘
                     │ HTTP
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 FLASK BACKEND (app.py:8000)                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                PIPELINE (pipeline.py)                     ││
│  │                                                          ││
│  │  Step 1: ┌──────────────┐  "hello" → fixed response     ││
│  │          │  Input Gate   │  crisis  → crisis response    ││
│  │          │(input_gate.py)│  normal  → proceed            ││
│  │          └──────┬───────┘                                ││
│  │                 ▼                                         ││
│  │  Step 2: ┌──────────────┐  DistilBERT GoEmotions         ││
│  │          │   Emotion     │  28 emotions                   ││
│  │          │  Detection    │  → (label, confidence)         ││
│  │          │(detection.py) │                                ││
│  │          └──────┬───────┘                                ││
│  │                 ▼                                         ││
│  │  Step 3: ┌──────────────┐  RoBERTa classifier            ││
│  │          │ Mental Health │  6 classes                      ││
│  │          │Classification │  → (label, confidence)         ││
│  │          │(detection.py) │                                ││
│  │          └──────┬───────┘                                ││
│  │                 ▼                                         ││
│  │  Step 4: ┌──────────────┐  Store message + scores         ││
│  │          │ Conversation  │                                ││
│  │          │   History     │                                ││
│  │          └──────┬───────┘                                ││
│  │                 ▼                                         ││
│  │  Step 5: ┌──────────────┐  all-MiniLM-L6-v2              ││
│  │          │  RAG Search   │  → best matching Q&A           ││
│  │          │(rag_search.py)│  from 126 pairs                ││
│  │          └──────┬───────┘                                ││
│  │                 ▼                                         ││
│  │  Step 6: ┌──────────────┐  Llama 3 instruct format       ││
│  │          │Prompt Builder │  emotion + category + RAG      ││
│  │          │               │  + history + user message      ││
│  │          └──────┬───────┘                                ││
│  │                 ▼                                         ││
│  │  Step 7: ┌──────────────┐  HTTP POST to Colab            ││
│  │          │ LLM Responder │  or local GGUF loading         ││
│  │          │               │  → counselor response          ││
│  │          └──────┬───────┘                                ││
│  │                 ▼                                         ││
│  │  Step 8: ┌──────────────┐  No diagnosis + safe closing   ││
│  │          │   Safety      │  + low confidence handling     ││
│  │          │  Guardrails   │                                ││
│  │          └──────┬───────┘                                ││
│  │                 ▼                                         ││
│  │  Step 9: Return {response, emotion, category, scores}    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              GOOGLE COLAB (T4 GPU)                           │
│                                                              │
│  ┌─────────────────────────────┐                            │
│  │  LLM Colab Server (Flask)   │                            │
│  │  Counselor_Llama3_Q4.gguf   │                            │
│  │  Port 5000 + ngrok tunnel   │                            │
│  │  POST /generate → response  │                            │
│  └─────────────────────────────┘                            │
│                                                              │
│  ┌─────────────────────────────┐                            │
│  │  ASR Colab Server (FastAPI) │                            │
│  │  Faster Whisper + Silero VAD│                            │
│  │  WebSocket + ngrok tunnel   │                            │
│  └─────────────────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

## 7.2 Step-by-Step Text Chat Flow

1. User types "I've been feeling really anxious about work" in the chat
2. **App.jsx** sends `POST /analyze` with `{"text": "..."}`
3. **detection.py** runs GoEmotions → "nervousness" (82%) and RoBERTa → "Anxiety" (91%)
4. **App.jsx** stores analysis in localStorage, sends `POST /api/chat` with `{"message": "..."}`
5. **pipeline.py** runs the 9-step pipeline:
   - Input gate: "proceed" (valid message)
   - Emotion: "nervousness" (0.82)
   - Category: "Anxiety" (0.91)
   - History: Stores message with scores
   - RAG: Finds similar question about work anxiety
   - Prompt: Builds Llama 3 format with all context
   - LLM: Sends to Colab → gets counselor response
   - Safety: Adds professional help suggestion (category_score > 0.85)
6. Response returned to App.jsx with emotion tags
7. **SentimentGraph** updates with new data point
8. User sees bot response with "🎭 Nervousness (82%) · 🧠 Anxiety (91%)" tags

---

# 8. Setup and Running Instructions

## 8.1 Prerequisites

- **Python 3.11+** installed
- **Node.js 18+** and npm installed
- **Google account** for Google Colab access
- **ngrok account** (free) for tunneling — https://dashboard.ngrok.com/signup

## 8.2 Step 1: Clone / Open the Project

Navigate to the project folder:
```powershell
cd "D:\College\Major Project\finalized model"
```

## 8.3 Step 2: Install Python Dependencies

```powershell
# Create virtual environment
python -m venv .venv

# Activate it (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

If `llama-cpp-python` fails to install (no C++ compiler), use the prebuilt wheel:
```powershell
pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu
```

## 8.4 Step 3: Install React Dependencies

```powershell
npm install
```

## 8.5 Step 4: Set Up the LLM on Google Colab

1. Upload `Counselor_Llama3_Q4.gguf` to **Google Drive** (root folder)
2. Open `colab/LLM_Colab_Server.ipynb` in Google Colab
3. Set runtime to **GPU** (Runtime → Change runtime type → T4 GPU)
4. Run all cells in order:
   - Cell 1: Installs dependencies
   - Cell 2: Mounts Google Drive and copies model
   - Cell 3: Enter your ngrok auth token
   - Cell 4: Loads model + starts Flask API
   - Cell 5: Creates ngrok tunnel → **copy the URL**
5. Copy the public URL (e.g., `https://xyz.ngrok-free.app`)

## 8.6 Step 5: Start the Backend

```powershell
# Activate venv
.\.venv\Scripts\Activate.ps1

# Set LLM API URL (paste your Colab URL)
$env:LLM_API_URL = "https://xyz.ngrok-free.app"

# Start Flask server
python app.py
```

You should see:
```
==================================================
  Mental Health AI Chatbot — Aria (Backend)
  API running at http://127.0.0.1:8000
==================================================
[LLM] Remote mode — using Colab API at https://xyz.ngrok-free.app
```

## 8.7 Step 6: Start the Frontend

Open a **new terminal**:
```powershell
npm run dev
```

You should see:
```
VITE v7.3.1  ready in 500 ms
  ➜  Local:   http://localhost:5173/
```

## 8.8 Step 7: Use the App

1. Open **http://localhost:5173** in your browser
2. Type a message in the chat and press Enter
3. The system will analyze emotions, generate a counselor response, and display results
4. Click "End Session" to see the session summary

## 8.9 Optional: Set Up ASR (Voice Input)

1. Open `asr/ASR_Colab_Server.ipynb` in Google Colab
2. Upload the 3 files from `asr/` folder
3. Run all cells → copy the `wss://...` URL
4. In the app, go to Voice Page → paste the URL → Connect Server → Start Recording

---

# 9. Future Improvements

## 9.1 Technical Improvements

| Improvement | Description |
|---|---|
| **Persistent Chat Storage** | Use a database (SQLite/PostgreSQL) instead of in-memory session storage so conversations survive server restarts |
| **User Authentication** | Add login/signup so users can access their history across devices |
| **Streaming Responses** | Implement Server-Sent Events (SSE) so the LLM response appears word-by-word instead of all at once |
| **Model Caching** | Cache RAG embeddings to disk to speed up server startup |
| **Response Evaluation** | Add automated quality scoring for LLM responses using embedding similarity with ideal answers |

## 9.2 Feature Improvements

| Improvement | Description |
|---|---|
| **Mood Journal** | Let users track their mood daily with a calendar view |
| **Guided Exercises** | Built-in breathing exercises, meditation timers, grounding techniques |
| **Multi-language Support** | Support Hindi and other languages for broader accessibility |
| **Therapist Handoff** | Provide direct links to book appointments with real therapists |
| **Progress Reports** | Weekly/monthly reports showing emotional trends over time |
| **Group Support** | Anonymous peer support chat rooms for shared experiences |

## 9.3 Deployment Improvements

| Improvement | Description |
|---|---|
| **Cloud Deployment** | Deploy on AWS/GCP/Azure instead of running locally + Colab |
| **Docker Containerization** | Package the entire backend in Docker for easy deployment |
| **Model Optimization** | Use ONNX Runtime or TensorRT for faster detection model inference |
| **CDN + Static Hosting** | Deploy React frontend to Vercel/Netlify for global access |
| **HTTPS** | Add SSL certificates for secure communication in production |

## 9.4 Safety Improvements

| Improvement | Description |
|---|---|
| **Content Moderation** | Add input filtering for harmful/abusive content directed at the bot |
| **Audit Logging** | Log all crisis detections for safety review |
| **Consent Flow** | Add a terms-of-service / disclaimer before first conversation |
| **Feedback System** | Let users rate responses (thumbs up/down) to improve quality over time |

---

# Appendix: API Reference

## Backend API (Flask — Port 8000)

### POST `/analyze`
Analyze text for emotion and mental health classification.

**Request:**
```json
{ "text": "I've been feeling really anxious lately" }
```

**Response:**
```json
{
  "emotion": { "label": "nervousness", "confidence": 0.82 },
  "mental_state": {
    "label": "Anxiety",
    "confidence": 0.91,
    "risk_level": "High",
    "all_scores": { "Anxiety": 0.91, "Depression": 0.04, "Normal": 0.03, ... }
  },
  "high_risk": false,
  "suicidal_signal": { "detected": false, "confidence": 0.01, "risk_level": "Low" }
}
```

### POST `/api/chat`
Process message through full pipeline.

**Request:**
```json
{ "message": "I've been feeling really anxious lately", "session_id": "session_123" }
```

**Response:**
```json
{
  "response": "I can hear that anxiety has been weighing on you. What situations tend to trigger it the most?",
  "emotion": "nervousness",
  "emotion_score": 0.82,
  "category": "Anxiety",
  "category_score": 0.91,
  "show_analysis": true,
  "gate_status": "proceed"
}
```

### GET `/api/sentiment?session_id=session_123`
Get sentiment trend data.

**Response:**
```json
{
  "scores": [
    { "message_number": 1, "emotion": "nervousness", "emotion_score": 0.82, "category": "Anxiety", "category_score": 0.91 },
    { "message_number": 2, "emotion": "sadness", "emotion_score": 0.65, "category": "Depression", "category_score": 0.58 }
  ]
}
```

### POST `/api/summary`
End session and get summary.

**Request:**
```json
{ "session_id": "session_123" }
```

**Response:**
```json
{
  "primary_emotion": "nervousness",
  "primary_category": "Anxiety",
  "trend": "Improved",
  "start_score": 0.82,
  "end_score": 0.45,
  "recommendation": "Consider speaking with a counselor for additional support.",
  "message_count": 5,
  "summary_text": "Session Summary\n..."
}
```

### GET `/api/history?session_id=session_123`
Get full conversation history.

**Response:**
```json
{
  "messages": [
    { "role": "user", "content": "I've been feeling anxious", "emotion": "nervousness", ... },
    { "role": "assistant", "content": "I hear you..." }
  ]
}
```

## LLM Colab API (Flask — ngrok tunnel)

### POST `/generate`
Generate counselor response.

**Request:**
```json
{ "prompt": "<|begin_of_text|>...", "max_tokens": 120, "temperature": 0.7 }
```

**Response:**
```json
{ "response": "I can hear that anxiety has been weighing on you..." }
```

### GET `/health`
Health check.

**Response:**
```json
{ "status": "ok", "model": "Counselor_Llama3_Q4", "gpu": true }
```

---

*Document generated for the Mental Health AI Chatbot — Aria project.*
*This document covers every file, component, and system interaction in the project.*
