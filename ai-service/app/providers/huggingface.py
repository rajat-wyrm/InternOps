"""Adapter for Hugging Face Serverless Inference API.

Same guardrails as gemini.py / openai.py: request timeout, streamed
response with a byte-size cap, and vendor-error -> domain-error mapping.

Uses the free Serverless Inference API at
https://api-inference.huggingface.co/models/{model}.
"""

import json
import os
from typing import Any, Dict

import httpx

from app.providers.base import (
    BaseAIProvider,
    ProviderAPIError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)

MAX_RESPONSE_BYTES = int(os.environ.get("AI_MAX_RESPONSE_BYTES", 2 * 1024 * 1024))


class HuggingFaceProvider(BaseAIProvider):
    """Adapter for Hugging Face Serverless Inference API."""

    def __init__(
        self,
        api_key: str,
        model_name: str = "meta-llama/Llama-3-8b-instruct",
        timeout: float = 30.0,
    ):
        super().__init__(api_key=api_key, model_name=model_name)
        self.timeout = timeout
        self.base_url = "https://api-inference.huggingface.co/models"

    async def generate_text(self, prompt: str, temperature: float = 0.7, **kwargs) -> str:
        payload = {
            "inputs": prompt,
            "parameters": {
                "temperature": temperature,
                "max_new_tokens": kwargs.get("max_new_tokens", 1024),
                "return_full_text": False,
            },
        }
        response_data = await self._send_request(payload)
        try:
            # HF Inference API returns: [{ "generated_text": "..." }]
            if isinstance(response_data, list) and len(response_data) > 0:
                return response_data[0]["generated_text"].strip()
            raise KeyError("Empty response array from Hugging Face")
        except (KeyError, IndexError, TypeError) as e:
            raise ProviderAPIError(
                f"Unexpected response payload from Hugging Face: {e}",
                self.provider_name,
            )

    async def generate_json(
        self, prompt: str, schema: Dict[str, Any], temperature: float = 0.2, **kwargs
    ) -> Dict[str, Any]:
        json_prompt = (
            f"{prompt}\n\nRespond ONLY with valid JSON matching this schema:\n"
            f"{json.dumps(schema)}"
        )
        payload = {
            "inputs": json_prompt,
            "parameters": {
                "temperature": temperature,
                "max_new_tokens": kwargs.get("max_new_tokens", 1024),
                "return_full_text": False,
            },
        }
        response_data = await self._send_request(payload)
        try:
            if isinstance(response_data, list) and len(response_data) > 0:
                raw_text = response_data[0]["generated_text"]
            else:
                raise KeyError("Empty response array from Hugging Face")
            return json.loads(raw_text)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
            raise ProviderAPIError(
                f"Failed to parse structured JSON from Hugging Face: {e}",
                self.provider_name,
            )

    async def _send_request(self, payload: Dict[str, Any]) -> Any:
        url = f"{self.base_url}/{self.model_name}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                async with client.stream(
                    "POST", url, headers=headers, json=payload
                ) as response:
                    if response.status_code == 429:
                        raise ProviderRateLimitError(
                            "Hugging Face rate limit or quota exceeded",
                            self.provider_name,
                            status_code=429,
                        )
                    if response.is_error:
                        body = await response.aread()
                        raise ProviderAPIError(
                            f"Hugging Face API error: {body.decode(errors='replace')}",
                            self.provider_name,
                            status_code=response.status_code,
                        )
                    return await self._read_json_with_limit(response)
            except httpx.TimeoutException:
                raise ProviderTimeoutError(
                    "Hugging Face API request timed out", self.provider_name
                )
            except httpx.RequestError as e:
                raise ProviderAPIError(
                    f"Network error connecting to Hugging Face API: {e}",
                    self.provider_name,
                )

    async def _read_json_with_limit(self, response: httpx.Response) -> Any:
        """Stream the body and enforce MAX_RESPONSE_BYTES before parsing.

        Returns either a list or dict depending on the HF endpoint response.
        """
        chunks = []
        received = 0
        async for chunk in response.aiter_bytes():
            received += len(chunk)
            if received > MAX_RESPONSE_BYTES:
                raise ProviderAPIError(
                    f"Hugging Face response exceeded {MAX_RESPONSE_BYTES} bytes",
                    self.provider_name,
                )
            chunks.append(chunk)
        try:
            return json.loads(b"".join(chunks))
        except json.JSONDecodeError as e:
            raise ProviderAPIError(
                f"Hugging Face returned invalid JSON: {e}", self.provider_name
            )
