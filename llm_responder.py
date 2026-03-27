"""
LLM Response Generator
Supports two modes:
  - REMOTE: Sends prompts to LLM running on Kaggle via ngrok API.
  - LOCAL: Loads Aria_SFT_DPO.gguf locally using llama-cpp-python.

Key fix: Uses proper Llama3 chat template format matching training.
System prompt is SHORT. Few-shot + history goes in user turn.
"""

import os
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

    def _get_followup_question(self, emotion=None):
        """Pick a relevant followup question based on emotion only.
        Returns None if no emotion detected — no question appended in that case.
        """
        import random
        if not emotion:
            return None
        key = emotion.lower() if emotion.lower() in FOLLOWUP_QUESTIONS else "default"
        return random.choice(FOLLOWUP_QUESTIONS[key])

    def _clean_response(self, text, user_message=None, emotion=None, turn_count=0):
        """
        Clean model output for MentalChat16K counselor model.
        - Strips prompt tokens and echoes only
        - No sentence cap — counselor responses are meant to be long
        - No list flattening — model outputs prose
        - Deduplicates repeated sentences
        """
        import re
        text = text.strip()

        # Strip prompt token leakage
        text = re.sub(r'<\|user\|>|<\|assistant\|>|<\|system\|>', '', text)

        # Remove extra turns if model continued generating
        # Split on any of these markers — take only what comes before
        import re as _re
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
        for s in sentences:
            lowered = s.strip().lower()
            if not lowered:
                continue
            if lowered in seen:
                continue
            if _HALLUCINATION_PATTERNS.search(s):
                continue
            # Skip sentences that are just a numbered list opener cut off mid-way
            # e.g. "Here are some suggestions: 1." or ending with a bare number
            if re.search(r'(:\s*\d+\.?\s*$|^\d+\.\s*$)', s.strip()):
                continue
            filtered.append(s.strip())
            seen.add(lowered)

        cleaned = ' '.join(filtered) if filtered else text

        # Sentence 5: append followup question when emotion detected
        sents = re.split(r'(?<=[.!?])\s+', cleaned.strip())
        sents = [s for s in sents if s.strip()]
        if emotion and len(sents) >= 4:
            followup = self._get_followup_question(emotion=emotion)
            if followup and not cleaned.rstrip().endswith("?"):
                cleaned = cleaned.rstrip() + ' ' + followup

        return cleaned

    def generate_response(self, messages, max_tokens=512, emotion=None, category=None, turn_count=0):
        """
        Generate response. Accepts a list of messages (chat history), builds a chat-style prompt.
        emotion + turn_count used for followup question on odd turns only.
        """
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
        return self._clean_response(raw, user_message=user_message, emotion=emotion, turn_count=turn_count)

    def _generate_local(self, formatted_prompt, max_tokens=512):
        """Generate response using local GGUF model."""
        output = self.llm(
            formatted_prompt,
            max_tokens=max_tokens,
            temperature=0.35,
            top_p=0.9,
            top_k=45,
            repeat_penalty=1.3,
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
            "temperature": 0.35,
            "top_k": 45,
            "repeat_penalty": 1.3,
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
                return data.get("response", "")
        except urllib.error.HTTPError as e:
            log.error("HTTP error %s: %s", e.code, e.read().decode("utf-8", errors="replace"))
            return f"Server error ({e.code}). Please try again."
        except urllib.error.URLError as e:
            log.error("Remote API error: %s", e)
            return "I'm having trouble connecting right now. Please try again in a moment."
        except Exception as e:
            log.error("Unexpected error: %s", e)
            return "Something went wrong. Please try again."