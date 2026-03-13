"""
LLM Response Generator (Task 4)
Supports two modes:
  - REMOTE (default): Sends prompts to LLM running on Google Colab via API.
    Set LLM_API_URL env var to the Colab ngrok URL.
  - LOCAL: Loads Counselor_Llama3_Q4.gguf locally using llama-cpp-python.
    Only use if you have 16+ GB RAM.
"""

import os
import re
import json
import urllib.request
import urllib.error


def _trim_to_last_sentence(text):
    """Trim text to the last complete sentence to avoid cut-off responses."""
    text = text.strip()
    if not text:
        return text
    # If already ends with sentence-ending punctuation, return as-is
    if text[-1] in '.!?"':
        return text
    # Find the last sentence-ending punctuation
    match = re.search(r'[.!?]["\')]?\s*', text)
    if match:
        # Find the LAST occurrence
        last_pos = 0
        for m in re.finditer(r'[.!?]["\')]?(?:\s|$)', text):
            last_pos = m.end()
        if last_pos > 0:
            return text[:last_pos].strip()
    return text


class LLMResponder:
    def __init__(self, model_path=None):
        """Initialize the LLM in remote or local mode.

        Remote mode (default): Set LLM_API_URL environment variable to
        the Colab ngrok URL (e.g. https://xyz.ngrok-free.dev).

        Local mode: Only used if LLM_API_URL is not set AND the .gguf
        file exists locally.
        """
        self.remote_url = os.environ.get("LLM_API_URL", "").strip()
        self.llm = None

        if self.remote_url:
            # Remote mode — LLM runs on Colab
            self.remote_url = self.remote_url.rstrip("/")
            print(f"[LLM] Remote mode — using Colab API at {self.remote_url}")
        else:
            # Local mode — load model into memory
            if model_path is None:
                model_path = os.path.join(
                    os.path.dirname(__file__), "Counselor_Llama3_Q4.gguf"
                )

            if not os.path.exists(model_path):
                raise FileNotFoundError(
                    f"Model file not found: {model_path}\n"
                    "Either:\n"
                    "  1. Set LLM_API_URL env var to your Colab ngrok URL, OR\n"
                    "  2. Place Counselor_Llama3_Q4.gguf in the project directory."
                )

            from llama_cpp import Llama
            print(f"[LLM] Local mode — loading {model_path}...")
            self.llm = Llama(
                model_path=model_path,
                n_ctx=2048,
                n_gpu_layers=-1,
                verbose=False
            )
            print("[LLM] Model loaded locally.")

    def generate_response(self, prompt):
        """Generate a therapist-like response from the prompt."""
        if self.remote_url:
            return self._generate_remote(prompt)
        else:
            return self._generate_local(prompt)

    def _generate_local(self, prompt):
        """Generate response using local GGUF model."""
        output = self.llm(
            prompt,
            max_tokens=256,
            temperature=0.7,
            stop=["User:", "Human:", "<|eot_id|>"],
            echo=False
        )
        return _trim_to_last_sentence(output["choices"][0]["text"])

    def _generate_remote(self, prompt):
        """Generate response by calling Colab LLM API."""
        url = f"{self.remote_url}/generate"
        payload = json.dumps({
            "prompt": prompt,
            "max_tokens": 256,
            "temperature": 0.7
        }).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return _trim_to_last_sentence(data.get("response", ""))
        except urllib.error.URLError as e:
            print(f"[LLM] Remote API error: {e}")
            return "I'm having trouble connecting to the language model right now. Please try again in a moment."
        except Exception as e:
            print(f"[LLM] Unexpected error: {e}")
            return "I'm sorry, something went wrong. Please try again."
