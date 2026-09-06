"""Adapter for OpenAI Chat Completions API.

Same guardrails as gemini.py: request timeout, streamed response with a
byte-size cap, and vendor-error -> domain-error mapping.
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


class OpenAIProvider(BaseAIProvider):
    """Adapter for OpenAI API."""

    def __init__(
        self,
        api_key: str,
        model_name: str = "gpt-4o-mini",
        timeout: float = 15.0,
    ):
        super().__init__(api_key=api_key, model_name=model_name)
        self.timeout = timeout
        self.base_url = "https://api.openai.com/v1/chat/completions"

    async def generate_text(self, prompt: str, temperature: float = 0.7, **kwargs) -> str:
        payload = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
        }
        response_data = await self._send_request(payload)
        try:
            return response_data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError) as e:
            raise ProviderAPIError(
                f"Unexpected response payload from OpenAI: {e}", self.provider_name
            )

    async def generate_json(
        self, prompt: str, schema: Dict[str, Any], temperature: float = 0.2, **kwargs
    ) -> Dict[str, Any]:
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": "You are a helpful assistant that outputs JSON."},
                {
                    "role": "user",
                    "content": f"{prompt}\n\nReturn JSON matching schema: {json.dumps(schema)}",
                },
            ],
            "temperature": temperature,
            "response_format": {"type": "json_object"},
        }
        response_data = await self._send_request(payload)
        try:
            raw_text = response_data["choices"][0]["message"]["content"]
            return json.loads(raw_text)
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            raise ProviderAPIError(
                f"Failed to parse structured JSON from OpenAI: {e}", self.provider_name
            )

    async def _send_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                async with client.stream(
                    "POST", self.base_url, headers=headers, json=payload
                ) as response:
                    if response.status_code == 429:
                        raise ProviderRateLimitError(
                            "OpenAI rate limit or quota exceeded",
                            self.provider_name,
                            status_code=429,
                        )
                    if response.is_error:
                        body = await response.aread()
                        raise ProviderAPIError(
                            f"OpenAI API error: {body.decode(errors='replace')}",
                            self.provider_name,
                            status_code=response.status_code,
                        )
                    return await self._read_json_with_limit(response)
            except httpx.TimeoutException:
                raise ProviderTimeoutError("OpenAI API request timed out", self.provider_name)
            except httpx.RequestError as e:
                raise ProviderAPIError(
                    f"Network error connecting to OpenAI API: {e}", self.provider_name
                )

    async def _read_json_with_limit(self, response: httpx.Response) -> Dict[str, Any]:
        chunks = []
        received = 0
        async for chunk in response.aiter_bytes():
            received += len(chunk)
            if received > MAX_RESPONSE_BYTES:
                raise ProviderAPIError(
                    f"OpenAI response exceeded {MAX_RESPONSE_BYTES} bytes",
                    self.provider_name,
                )
            chunks.append(chunk)
        try:
            return json.loads(b"".join(chunks))
        except json.JSONDecodeError as e:
            raise ProviderAPIError(f"OpenAI returned invalid JSON: {e}", self.provider_name)
