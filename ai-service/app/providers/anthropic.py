"""Adapter for Anthropic Messages API.

Same guardrails as gemini.py / openai.py: request timeout, streamed
response with a byte-size cap, and vendor-error -> domain-error mapping.
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

# Anthropic requires max_tokens to be set explicitly (no default on their end).
DEFAULT_MAX_TOKENS = 4096


class AnthropicProvider(BaseAIProvider):
    """Adapter for Anthropic Messages API."""

    def __init__(
        self,
        api_key: str,
        model_name: str = "claude-3-5-sonnet-latest",
        timeout: float = 15.0,
    ):
        super().__init__(api_key=api_key, model_name=model_name)
        self.timeout = timeout
        self.base_url = "https://api.anthropic.com/v1/messages"

    async def generate_chat(self, messages: list[dict], temperature: float = 0.7, **kwargs) -> str:
        system_prompts = [m["content"] for m in messages if m.get("role") == "system"]
        anthropic_messages = [m for m in messages if m.get("role") != "system"]
                
        payload = {
            "model": self.model_name,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "messages": anthropic_messages,
            "temperature": temperature,
        }
        if system_prompts:
            payload["system"] = "\n".join(system_prompts).strip()
            
        response_data = await self._send_request(payload)
        try:
            return response_data["content"][0]["text"].strip()
        except (KeyError, IndexError) as e:
            raise ProviderAPIError(
                f"Unexpected response payload from Anthropic: {e}", self.provider_name
            )

    async def generate_json(
        self, prompt: str, schema: Dict[str, Any], temperature: float = 0.2, **kwargs
    ) -> Dict[str, Any]:
        json_prompt = (
            f"{prompt}\n\nRespond ONLY with valid JSON matching this schema:\n"
            f"{json.dumps(schema)}"
        )
        payload = {
            "model": self.model_name,
            "max_tokens": kwargs.get("max_tokens", DEFAULT_MAX_TOKENS),
            "messages": [{"role": "user", "content": json_prompt}],
            "temperature": temperature,
        }
        response_data = await self._send_request(payload)
        try:
            raw_text = response_data["content"][0]["text"]
            return json.loads(raw_text)
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            raise ProviderAPIError(
                f"Failed to parse structured JSON from Anthropic: {e}",
                self.provider_name,
            )

    async def _send_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                async with client.stream(
                    "POST", self.base_url, headers=headers, json=payload
                ) as response:
                    if response.status_code == 429:
                        raise ProviderRateLimitError(
                            "Anthropic rate limit or quota exceeded",
                            self.provider_name,
                            status_code=429,
                        )
                    if response.is_error:
                        body = await response.aread()
                        raise ProviderAPIError(
                            f"Anthropic API error: {body.decode(errors='replace')}",
                            self.provider_name,
                            status_code=response.status_code,
                        )
                    return await self._read_json_with_limit(response)
            except httpx.TimeoutException:
                raise ProviderTimeoutError(
                    "Anthropic API request timed out", self.provider_name
                )
            except httpx.RequestError as e:
                raise ProviderAPIError(
                    f"Network error connecting to Anthropic API: {e}", self.provider_name
                )

    async def _read_json_with_limit(self, response: httpx.Response) -> Dict[str, Any]:
        chunks = []
        received = 0
        async for chunk in response.aiter_bytes():
            received += len(chunk)
            if received > MAX_RESPONSE_BYTES:
                raise ProviderAPIError(
                    f"Anthropic response exceeded {MAX_RESPONSE_BYTES} bytes",
                    self.provider_name,
                )
            chunks.append(chunk)
        try:
            return json.loads(b"".join(chunks))
        except json.JSONDecodeError as e:
            raise ProviderAPIError(
                f"Anthropic returned invalid JSON: {e}", self.provider_name
            )
