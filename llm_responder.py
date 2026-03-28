"""
LLM Response Generator
Supports two modes:
  - REMOTE: Sends prompts to LLM running on Kaggle via ngrok API.
  - LOCAL: Loads Aria_SFT_DPO.gguf locally using llama-cpp-python.

Key fix: Uses proper Llama3 chat template format matching training.
System prompt is SHORT. Few-shot + history goes in user turn.
"""

import os
import re
import json
import logging
import urllib.request
import urllib.error

from followup_questions import FOLLOWUP_QUESTIONS

log = logging.getLogger("mindcare.llm")


class LLMResponder:
    def __init__(self, model_path=None):
        self.remote_url = os.environ.get("LLM_API_URL", "").strip()
        self.llm = None

        if self.remote_url:
            self.remote_url = self.remote_url.rstrip("/")
            log.info("Remote mode — using Kaggle API at %s", self.remote_url)
        else:
            if model_path is None:
                model_path = os.path.join(
                    os.path.dirname(__file__), "Aria_SFT_DPO.gguf"
                )
            if not os.path.exists(model_path):
                raise FileNotFoundError(
                    f"Model file not found: {model_path}\n"
                    "Set LLM_API_URL env var to your Kaggle ngrok URL, OR\n"
                    "place Aria_SFT_DPO.gguf in the project directory."
                )
            from llama_cpp import Llama
            log.info("Local mode — loading %s...", model_path)
            self.llm = Llama(
                model_path=model_path,
                n_ctx=4096,
                n_gpu_layers=-1,
                verbose=False
            )
            log.info("Model loaded locally.")


    def _build_llama3_prompt(self, messages):
        """
        Build a chat-style prompt from a list of messages (dicts with 'role' and 'content').
        Follows the template: <|user|>...<|assistant|>...<|assistant|>\n
        Example:
        [
            {"role": "user", "content": "Hi"},
            {"role": "assistant", "content": "Hello!"},
            {"role": "user", "content": "How are you?"}
        ]
        →
        <|user|>\nHi\n<|assistant|>\nHello!\n<|user|>\nHow are you?\n<|assistant|>\n
        """
        prompt = ""
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content", "").strip()
            if role == "system":
                prompt += "<|system|>\n" + content + "\n"
            elif role == "user":
                prompt += "<|user|>\n" + content + "\n"
            else:
                prompt += "<|assistant|>\n" + content + "\n"
        prompt += "<|assistant|>\n"
        return prompt

    _FALLBACK_RESPONSES = [
        "I hear you. Take all the time you need.",
        "That sounds really tough. I'm with you.",
        "I'm here — you don't have to go through this alone.",
        "It makes sense that you'd feel this way.",
        "Thanks for sharing that with me.",
    ]

    def _get_followup_question(self, emotion=None, emotion_score=0.0):
        """Pick a relevant followup question based on emotion.
        Only uses the emotion bucket when confidence is reasonably high (>= 0.55).
        Falls back to 'default' otherwise to avoid mismatched questions.
        """
        import random
        key = "default"
        if emotion and emotion.lower() in FOLLOWUP_QUESTIONS and emotion_score >= 0.55:
            key = emotion.lower()
        return random.choice(FOLLOWUP_QUESTIONS[key])

    def _clean_response(self, text, user_message=None, emotion=None, turn_count=0):
        """
        Clean model output for MentalChat16K counselor model.
        - Strips prompt tokens and echoes only
        - No sentence cap — counselor responses are meant to be long
        - No list flattening — model outputs prose
        - Deduplicates repeated sentences
        """
        # If the model starts hallucinating the next turn using template tokens,
        # cut the response off entirely right there!
        import re as _re
        text = _re.split(r'<\|user\|>|<\|system\|>', text, maxsplit=1)[0].strip()

        # Remove any stray <|assistant|> tokens that might have been echoed
        text = _re.sub(r'<\|assistant\|>', '', text).strip()

        # Remove extra turns if model continued generating
        # Split on any of these markers — take only what comes before
        text = _re.split(
            r'\n(?:User|Human|Patient|Counselor)\s*:',
            text, maxsplit=1
        )[0].strip()
        # Also catch inline (no newline) versions
        for marker in ("User:", "Human:", "Patient:", "Counselor (continued):"):
            if marker in text:
                text = text.split(marker)[0].strip()

        # Remove echo of user message at the start
        if user_message:
            pattern = re.escape(user_message.strip())
            text = re.sub(rf'^\s*{pattern}\s*', '', text, flags=re.IGNORECASE)

        text = re.sub(r'\s{2,}', ' ', text).strip()

        # Deduplicate repeated sentences (repetition loop guard)
        _HALLUCINATION_PATTERNS = re.compile(
            r"i'?m glad (you|that you)|you'?ve found|as (you|we) (mentioned|discussed|talked)|"
            r"as i (mentioned|said)|you told me|you shared (earlier|before)|"
            r"glad to hear (you|that)|it('?s| is) good to (know|hear) that you",
            re.IGNORECASE
        )
        sentences = re.split(r'(?<=[.!?])\s+', text)
        seen = set()
        filtered = []
        for i, s in enumerate(sentences):
            s_stripped = s.strip()
            if not s_stripped:
                continue
                
            # Drop incomplete final sentence if text was abruptly cut off (e.g., token limit)
            if i == len(sentences) - 1 and not s_stripped[-1] in ('.', '!', '?'):
                continue
                
            lowered = s_stripped.lower()
            if lowered in seen:
                continue
            if _HALLUCINATION_PATTERNS.search(s_stripped):
                continue
            # Skip sentences that are just a numbered list opener cut off mid-way
            # e.g. "Here are some suggestions: 1." or ending with a bare number
            if _re.search(r'(:\s*\d+\.?\s*$|^\d+\.\s*$)', s_stripped):
                continue
            filtered.append(s_stripped)
            seen.add(lowered)

        cleaned = ' '.join(filtered) if filtered else text
        cleaned = cleaned.strip()

        # Fallback if the model output was entirely empty or dropped
        if not cleaned:
            import random
            cleaned = random.choice(self._FALLBACK_RESPONSES)

        # Ensure we always append a followup question if the model forgot to end with one
        if not cleaned.rstrip().endswith("?"):
            followup = self._get_followup_question(emotion=emotion, emotion_score=getattr(self, '_last_emotion_score', 0.0))
            if followup:
                cleaned = cleaned.rstrip() + ' ' + followup

        return cleaned

    def generate_response(self, messages, max_tokens=512, emotion=None, emotion_score=0.0, category=None, turn_count=0):
        """
        Generate response. Accepts a list of messages (chat history), builds a chat-style prompt.
        emotion + turn_count used for followup question on odd turns only.
        """
        self._last_emotion_score = emotion_score
        _ERROR_STRINGS = (
            "something went wrong",
            "server error",
            "please try again",
            "having trouble connecting",
        )

        formatted = self._build_llama3_prompt(messages)
        user_message = None
        for msg in reversed(messages):
            if msg.get("role") == "user":
                user_message = msg.get("content", "")
                break
        if self.remote_url:
            raw = self._generate_remote(formatted, max_tokens=max_tokens)
        else:
            raw = self._generate_local(formatted, max_tokens=max_tokens)

        # Block error strings from reaching the user
        if any(e in raw.lower() for e in _ERROR_STRINGS):
            raw = ""

        cleaned = self._clean_response(raw, user_message=user_message, emotion=emotion, turn_count=turn_count)

        # Repetition guard — if response is too similar to last assistant message,
        # re-generate once with slightly rephrased instruction instead of a generic fallback
        last_assistant = None
        for msg in reversed(messages):
            if msg.get("role") == "assistant":
                last_assistant = msg.get("content", "")
                break

        if last_assistant and cleaned:
            overlap = len(
                set(cleaned.lower().split()) & set(last_assistant.lower().split())
            ) / max(len(set(cleaned.lower().split())), 1)
            if overlap > 0.6:
                # Re-generate with an explicit nudge to respond differently
                import copy
                nudged = copy.deepcopy(messages)
                for m in reversed(nudged):
                    if m.get("role") == "user":
                        m["content"] += "\n\n[Note: Your previous response was very repetitive. Respond differently using new words or a new angle.]"
                        break
                nudged_prompt = self._build_llama3_prompt(nudged)
                if self.remote_url:
                    raw2 = self._generate_remote(nudged_prompt, max_tokens=max_tokens)
                else:
                    raw2 = self._generate_local(nudged_prompt, max_tokens=max_tokens)
                if raw2 and not any(e in raw2.lower() for e in _ERROR_STRINGS):
                    cleaned = self._clean_response(raw2, user_message=user_message, emotion=emotion, turn_count=turn_count)

        return cleaned

    def _generate_local(self, formatted_prompt, max_tokens=512):
        """Generate response using local GGUF model."""
        output = self.llm(
            formatted_prompt,
            max_tokens=max_tokens,
            temperature=0.85,
            top_p=0.95,
            top_k=50,
            repeat_penalty=1.1,
            presence_penalty=0.1,
            frequency_penalty=0.05,
            stop=[
                "User:", "Human:", "Aria:", "Patient:",
                "<|eot_id|>", "<|end_of_text|>", "<|start_header_id|>",
                "\nUser:", "\nHuman:", "\nPatient:",
                "Counselor (continued):",
                "I'd encourage you to speak",  # repetitive closing the model overuses
            ],
            echo=False
        )
        raw = output["choices"][0]["text"]

        # Strip citation markers like "1 .", "[1]", "(1)", "¹"
        raw = re.sub(r'\s*[\(\[]\d+[\)\]]\s*|\s+\d+\s*\.(?!\w)|\s*[¹²³⁴⁵⁶⁷⁸⁹]', '', raw).strip()

        # Strip from the first numbered list item onward (any number)
        raw = re.sub(r'\s*\d+[.)]\s+.*', '', raw, flags=re.DOTALL).strip()

        # Strip colon-labeled soft list items e.g. "Self-care - ..." or "Reach out for support: ..."
        raw = re.sub(r'\b[A-Z][^.!?]{0,40}[-:]\s+[A-Z].*', '', raw, flags=re.DOTALL).strip()

        # Safety net: repetition loop detection.
        # Use 6-word window and require 4+ repeats to avoid false positives
        # on short but valid counselor responses.
        words = raw.split()
        if len(words) >= 12:
            window = " ".join(words[:6]).lower()
            if raw.lower().count(window) >= 4:
                log.warning("Repetition loop detected — returning fallback")
                return ""
        return raw

    def _generate_remote(self, formatted_prompt, max_tokens=512):
        """Generate response by calling Kaggle LLM API."""
        log.debug("Sending prompt:\n%s", formatted_prompt)
        url = f"{self.remote_url}/generate"
        payload = json.dumps({
            "prompt": formatted_prompt,
            "max_tokens": max_tokens,
            "temperature": 0.85,
            "top_k": 50,
            "repeat_penalty": 1.1,
        }).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true"
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                raw = data.get("response", "")
                # Strip citation markers like "1 .", "[1]", "(1)", "¹"
                raw = re.sub(r'\s*[\(\[]\d+[\)\]]\s*|\s+\d+\s*\.(?!\w)|\s*[¹²³⁴⁵⁶⁷⁸⁹]', '', raw).strip()
                # Strip from the first numbered list item onward (any number)
                raw = re.sub(r'\s*\d+[.)]\s+.*', '', raw, flags=re.DOTALL).strip()
                # Strip colon-labeled soft list items
                raw = re.sub(r'\b[A-Z][^.!?]{0,40}[-:]\s+[A-Z].*', '', raw, flags=re.DOTALL).strip()
                return raw
        except urllib.error.HTTPError as e:
            log.error("HTTP error %s: %s", e.code, e.read().decode("utf-8", errors="replace"))
            return f"Server error ({e.code}). Please try again."
        except urllib.error.URLError as e:
            log.error("Remote API error: %s", e)
            return "I'm having trouble connecting right now. Please try again in a moment."
        except Exception as e:
            log.error("Unexpected error: %s", e)
            return "Something went wrong. Please try again."