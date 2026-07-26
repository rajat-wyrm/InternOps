"""Adapter for Google Gemini REST API.

Mirrors the guardrails used in the Node `aiProviderService.js` reference:
request timeout, streamed response with a byte-size cap (instead of
buffering the full body via `.json()`), and vendor-error -> domain-error
mapping (429 -> rate limit, other non-2xx -> API error, network/timeout ->
timeout error).
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

# Mirrors AI_MAX_RESPONSE_BYTES in the JS reference (default 2MB there;
# provider adapters here use the same default so behavior is consistent
# across both services).
MAX_RESPONSE_BYTES = int(os.environ.get("AI_MAX_RESPONSE_BYTES", 2 * 1024 * 1024))


class GeminiProvider(BaseAIProvider):
    """Adapter for Google Gemini REST/SDK API."""

    def __init__(
        self,
        api_key: str,
        model_name: str = "gemini-2.5-flash",
        timeout: float = 15.0,
    ):
        super().__init__(api_key=api_key, model_name=model_name)
        self.timeout = timeout
        self.base_url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model_name}:generateContent"
        )

    async def generate_text(self, prompt: str, temperature: float = 0.7, **kwargs) -> str:
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": temperature},
        }
        response_data = await self._send_request(payload)
        try:
            return response_data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as e:
            raise ProviderAPIError(
                f"Unexpected response payload from Gemini: {e}", self.provider_name
            )

    async def generate_json(
        self, prompt: str, schema: Dict[str, Any], temperature: float = 0.2, **kwargs
    ) -> Dict[str, Any]:
        json_prompt = (
            f"{prompt}\n\nRespond ONLY with valid JSON matching this schema:\n"
            f"{json.dumps(schema)}"
        )
        payload = {
            "contents": [{"parts": [{"text": json_prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "responseMimeType": "application/json",
            },
        }
        response_data = await self._send_request(payload)
        try:
            raw_text = response_data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(raw_text)
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            raise ProviderAPIError(
                f"Failed to parse structured JSON from Gemini response: {e}",
                self.provider_name,
            )

    async def _send_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}?key={self.api_key}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code == 429:
                        raise ProviderRateLimitError(
                            "Gemini rate limit or quota exceeded",
                            self.provider_name,
                            status_code=429,
                        )
                    if response.is_error:
                        body = await response.aread()
                        raise ProviderAPIError(
                            f"Gemini API error: {body.decode(errors='replace')}",
                            self.provider_name,
                            status_code=response.status_code,
                        )
                    return await self._read_json_with_limit(response)
            except httpx.TimeoutException:
                raise ProviderTimeoutError("Gemini API request timed out", self.provider_name)
            except httpx.RequestError as e:
                raise ProviderAPIError(
                    f"Network error connecting to Gemini API: {e}", self.provider_name
                )

    async def _read_json_with_limit(self, response: httpx.Response) -> Dict[str, Any]:
        """Stream the body and enforce MAX_RESPONSE_BYTES before parsing,
        instead of buffering an unbounded body via response.json()."""
        chunks = []
        received = 0
        async for chunk in response.aiter_bytes():
            received += len(chunk)
            if received > MAX_RESPONSE_BYTES:
                raise ProviderAPIError(
                    f"Gemini response exceeded {MAX_RESPONSE_BYTES} bytes",
                    self.provider_name,
                )
            chunks.append(chunk)
        try:
            return json.loads(b"".join(chunks))
        except json.JSONDecodeError as e:
            raise ProviderAPIError(f"Gemini returned invalid JSON: {e}", self.provider_name)
