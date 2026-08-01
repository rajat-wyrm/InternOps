"""
Orchestrator - tries the primary AI provider, falls back to configured
fallback providers on failure, and logs every attempt (success or
failure) to ai_usage_logs via the usage repository.

NOTE: gemini.py / openai.py do not currently return token usage data
from the vendor API responses, so prompt_tokens/completion_tokens are
logged as 0 for now.
"""

import time
import uuid
from typing import Any, Dict, Optional

from app.core.config import settings
from app.providers.base import AIProviderError
from app.providers.registry import get_provider
from app.repositories.usage import log_ai_request


async def generate_text_with_fallback(
    user_id: uuid.UUID,
    prompt: str,
    temperature: float = 0.7,
    **kwargs,
) -> str:
    """Try the primary provider, then each active fallback, in order.
    Logs every attempt. Returns the first successful result."""
    provider_names = [settings.PRIMARY_AI_PROVIDER] + settings.ACTIVE_FALLBACK_PROVIDERS
    last_error: Optional[Exception] = None

    for name in provider_names:
        start = time.monotonic()
        provider = None
        try:
            provider = get_provider(name)
            result = await provider.generate_text(prompt, temperature=temperature, **kwargs)
            latency_ms = int((time.monotonic() - start) * 1000)
            await log_ai_request(
                user_id=user_id,
                provider=name,
                model=provider.model_name,
                prompt_tokens=0,
                completion_tokens=0,
                latency_ms=latency_ms,
                status="success",
            )
            return result
        except AIProviderError as e:
            latency_ms = int((time.monotonic() - start) * 1000)
            await log_ai_request(
                user_id=user_id,
                provider=name,
                model=provider.model_name if provider is not None else name,
                prompt_tokens=0,
                completion_tokens=0,
                latency_ms=latency_ms,
                status="failure",
            )
            last_error = e

    raise last_error


async def generate_json_with_fallback(
    user_id: uuid.UUID,
    prompt: str,
    schema: Dict[str, Any],
    temperature: float = 0.2,
    **kwargs,
) -> Dict[str, Any]:
    """Same as generate_text_with_fallback, but for structured JSON output."""
    provider_names = [settings.PRIMARY_AI_PROVIDER] + settings.ACTIVE_FALLBACK_PROVIDERS
    last_error: Optional[Exception] = None

    for name in provider_names:
        start = time.monotonic()
        provider = None
        try:
            provider = get_provider(name)
            result = await provider.generate_json(
                prompt, schema=schema, temperature=temperature, **kwargs
            )
            latency_ms = int((time.monotonic() - start) * 1000)
            await log_ai_request(
                user_id=user_id,
                provider=name,
                model=provider.model_name,
                prompt_tokens=0,
                completion_tokens=0,
                latency_ms=latency_ms,
                status="success",
            )
            return result
        except AIProviderError as e:
            latency_ms = int((time.monotonic() - start) * 1000)
            await log_ai_request(
                user_id=user_id,
                provider=name,
                model=provider.model_name if provider is not None else name,
                prompt_tokens=0,
                completion_tokens=0,
                latency_ms=latency_ms,
                status="failure",
            )
            last_error = e

    raise last_error
