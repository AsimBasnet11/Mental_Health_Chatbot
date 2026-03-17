"""
LLM Response Generator (Task 4)
Supports two modes:
  - REMOTE (default): Sends prompts to LLM running on Google Colab via API.
    Set LLM_API_URL env var to the Colab ngrok URL.
  - LOCAL: Loads Counselor_Llama3_Q4.gguf locally using llama-cpp-python.
    Only use if you have 16+ GB RAM.
"""

import os
import json
import logging
import urllib.request
import urllib.error

log = logging.getLogger("mindcare.llm")


class LLMResponder:
    def __init__(self, model_path=None):
        """Initialize the LLM in remote or local mode.

        Remote mode (default): Set LLM_API_URL environment variable to
        the Colab ngrok URL (e.g. https://xyz.ngrok-free.dev).

        Local mode: Only used if LLM_API_URL is not set AND the .gguf
        file exists locally.
        """
        self.remote_url = os.environ.get(
            "LLM_API_URL", "https://spongy-kynlee-unflat.ngrok-free.dev"
        ).strip()
        self.llm = None

        if self.remote_url:
            # Remote mode — LLM runs on Colab
            self.remote_url = self.remote_url.rstrip("/")
            log.info("Remote mode — using Colab API at %s", self.remote_url)
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

            from llama_cpp import Llama  # type: ignore[reportMissingImports]
            log.info("Local mode — loading %s...", model_path)
            self.llm = Llama(
                model_path=model_path,
                n_ctx=2048,
                n_gpu_layers=-1,
                verbose=False
            )
            log.info("Model loaded locally.")

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
            max_tokens=150,
            temperature=0.7,
            stop=["User:", "Human:", "<|eot_id|>"],
            echo=False
        )
        return output["choices"][0]["text"].strip()

    def _generate_remote(self, prompt):
        """Generate response by calling Colab LLM API."""
        url = f"{self.remote_url}/generate"
        payload = json.dumps({
            "prompt": prompt,
            "max_tokens": 150,
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
                return data.get("response", "").strip()
        except urllib.error.URLError as e:
            log.error("Remote API error: %s", e)
            return "I'm having trouble connecting to the language model right now. Please try again in a moment."
        except Exception as e:
            log.error("Unexpected error: %s", e)
            return "I'm sorry, something went wrong. Please try again."