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
            if msg.get("role") == "user":
                prompt += "<|user|>\n" + msg.get("content", "").strip() + "\n"
            else:
                prompt += "<|assistant|>\n" + msg.get("content", "").strip() + "\n"
        prompt += "<|assistant|>\n"
        return prompt

    def _clean_response(self, text, user_message=None):
        """Clean up model output, strip prompt tokens, remove user echoes, and match .html frontend post-processing."""
        import re
        text = text.strip()
        # Strip Aria prefix if echoed
        if text.lower().startswith("aria:"):
            text = text[5:].strip()
        # Remove <|user|> and <|assistant|> tokens
        text = re.sub(r'<\|user\|>|<\|assistant\|>', '', text)
        # Remove extra turns
        if "User:" in text:
            text = text.split("User:")[0].strip()
        if "\nAria:" in text:
            text = text.split("\nAria:")[0].strip()
        # Remove echo of user message at the start (if present)
        if user_message:
            # Remove if the response starts with the user message (ignoring case/whitespace)
            pattern = re.escape(user_message.strip())
            text = re.sub(rf'^\s*{pattern}\s*', '', text, flags=re.IGNORECASE)

        # Limit to first 3 sentences, remove repeated sentences (like .html)
        sentences = re.findall(r'[^.!?]+[.!?]+', text)
        if not sentences:
            sentences = [text]
        seen = set()
        filtered = []
        for s in sentences:
            trimmed = s.strip()
            lowered = trimmed.lower()
            if lowered and lowered not in seen:
                filtered.append(trimmed)
                seen.add(lowered)
            if len(filtered) >= 3:
                break
        cleaned = ' '.join(filtered) if filtered else text
        return cleaned

    def generate_response(self, messages, max_tokens=300):
        """
        Generate response. Accepts a list of messages (chat history), builds a chat-style prompt.
        """
        formatted = self._build_llama3_prompt(messages)
        # Get the latest user message for echo removal
        user_message = None
        for msg in reversed(messages):
            if msg.get("role") == "user":
                user_message = msg.get("content", "")
                break
        if self.remote_url:
            raw = self._generate_remote(formatted, max_tokens=max_tokens)
        else:
            raw = self._generate_local(formatted, max_tokens=max_tokens)
        return self._clean_response(raw, user_message=user_message)

    def _generate_local(self, formatted_prompt, max_tokens=300):
        """Generate response using local GGUF model."""
        output = self.llm(
            formatted_prompt,
            max_tokens=max_tokens,
            temperature=0.7,
            top_p=0.9,
            top_k=20,
            repeat_penalty=1.18,          # raised: 1.1 → 1.18 to kill repetition loops
            presence_penalty=0.1,          # new: penalise tokens already seen in prompt
            frequency_penalty=0.05,        # new: mild penalty for repeated tokens
            stop=[
                "User:", "Human:", "Aria:",
                "<|eot_id|>", "<|end_of_text|>", "<|start_header_id|>",
                "\nUser:", "\nHuman:",      # catch newline-prefixed echoes
            ],
            echo=False
        )
        raw = output["choices"][0]["text"]

        # Safety net: if output is a repetition loop, return fallback early.
        # Check on raw before generate_response does the final clean.
        words = raw.split()
        if len(words) >= 6:
            window = " ".join(words[:4]).lower()
            if raw.lower().count(window) >= 3:
                log.warning("Repetition loop detected in output — returning fallback")
                return ""  # pipeline will regenerate or guardrails will expand
        return raw  # generate_response() calls _clean_response() once with user_message

    def _generate_remote(self, formatted_prompt, max_tokens=300):
        """Generate response by calling Kaggle LLM API."""
        log.debug("Sending prompt:\n%s", formatted_prompt)
        url = f"{self.remote_url}/generate"
        payload = json.dumps({
            "prompt": formatted_prompt,
            "max_tokens": max_tokens,
            "temperature": 0.75
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