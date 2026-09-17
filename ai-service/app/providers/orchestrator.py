import asyncio
import time
import hashlib
import json
import logging
from typing import Dict, Any, List, Optional, Tuple

from app.core.config import settings
from app.core.cache import cache_key, get_cached, set_cached
from app.core.redis_client import get_redis
from app.providers.base import AIProviderError, ProviderAPIError
from app.providers.registry import get_provider

logger = logging.getLogger(__name__)


def generate_cache_key(
    prompt: str,
    provider_name: str,
    temperature: float,
    kwargs: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generates a deterministic SHA-256 cache key from request parameters.
    Delegates to app.core.cache.cache_key for consistent key generation.
    """
    kw = kwargs or {}
    model = kw.get("model", "")
    return cache_key(
        provider=provider_name,
        model=model,
        prompt=prompt,
        temperature=temperature,
        **{k: v for k, v in kw.items() if k != "model"},
    )


class CircuitBreaker:
    def __init__(self):
        self.failures = 0
        self.disabled_until: Optional[float] = None
        self._lock = asyncio.Lock()

    async def is_open(self) -> bool:
        """Pure query: check if the circuit is currently open (and cooldown has not expired).
        Does not acquire a lock as this is a pure read query and attributes access is atomic.
        """
        if self.disabled_until is not None:
            if time.time() < self.disabled_until:
                return True
        return False

    async def allow_request(self) -> bool:
        """Check request permission and handle cooldown state transitions atomically under lock."""
        async with self._lock:
            if self.disabled_until is not None:
                if time.time() < self.disabled_until:
                    return False
                else:
                    # Cooldown expired, transition to CLOSED/probe state (state mutation)
                    self.failures = 0
                    self.disabled_until = None
            return True

    async def record_failure(self):
        async with self._lock:
            self.failures += 1
            limit = settings.AI_PROVIDER_FAILURE_LIMIT
            cooldown_seconds = settings.AI_PROVIDER_COOLDOWN_MS / 1000.0
            if self.failures >= limit:
                self.disabled_until = time.time() + cooldown_seconds

    async def record_success(self):
        async with self._lock:
            self.failures = 0
            self.disabled_until = None


# In-memory registry of circuit breakers per provider
_circuit_breakers: Dict[str, CircuitBreaker] = {}


def get_circuit_breaker(provider_name: str) -> CircuitBreaker:
    name = provider_name.lower().strip()
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker()
    return _circuit_breakers[name]


class AIOrchestrator:
    """
    Orchestration layer supporting:
    - Multi-provider failover
    - Circuit breaker pattern
    - Automatic fallback
    - AI response caching & deduplication using Redis
    - Uses PRIMARY_AI_PROVIDER and ACTIVE_FALLBACK_PROVIDERS
    """

    async def generate_chat(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        **kwargs,
    ) -> str:
        content, _ = await self.generate_chat_with_fallback(messages, temperature=temperature, **kwargs)
        return content

    async def generate_json(
        self,
        prompt: str,
        schema: Dict[str, Any],
        temperature: float = 0.2,
        **kwargs,
    ) -> Dict[str, Any]:
        data, _ = await self.generate_json_with_fallback(
            prompt, schema=schema, temperature=temperature, **kwargs
        )
        return data

    async def generate_image(
        self,
        prompt: str,
        **kwargs,
    ) -> str:
        data, _ = await self.generate_image_with_fallback(prompt, **kwargs)
        return data

    async def generate_image_with_fallback(
        self,
        prompt: str,
        **kwargs,
    ) -> Tuple[str, str]:
        result, provider_name, _cached = await self._execute_with_failover(
            "generate_image", prompt, **kwargs
        )
        return result, provider_name

    async def generate_text_with_fallback(
        self,
        prompt: str,
        temperature: float = 0.7,
        **kwargs,
    ) -> Tuple[str, str]:
        result, provider_name, _cached = await self._execute_with_failover(
            "generate_text",
            prompt,
            temperature=temperature,
            **kwargs,
        )
        return result, provider_name

    async def generate_chat_with_fallback(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        **kwargs,
    ) -> Tuple[str, str]:
        content, provider_name, _cached = await self._execute_with_failover(
            "generate_chat",
            messages,
            temperature=temperature,
            **kwargs
        )
        return content, provider_name

    async def generate_chat_with_cache_status(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        **kwargs,
    ) -> Tuple[str, str, bool]:
        """
        Same as generate_chat_with_fallback(), but also reports whether the
        response came from the orchestrator's cache (see cache_key() /
        _execute_with_failover() below) instead of a live provider call.

        POST /ai/chat is the one caller that needs this, since its response
        body includes a `cached` flag. Every other caller keeps using
        generate_chat_with_fallback()/generate_text_with_fallback()/etc.,
        which still return the plain (result, provider_name) pair — the
        caching itself is identical either way, this just also surfaces
        the hit/miss status instead of discarding it.
        """
        return await self._execute_with_failover(
            "generate_chat",
            messages,
            temperature=temperature,
            **kwargs
        )

    async def generate_json_with_fallback(
        self,
        prompt: str,
        schema: Dict[str, Any],
        temperature: float = 0.2,
        **kwargs,
    ) -> Tuple[Dict[str, Any], str]:
        """
        Attempts to generate structured JSON by calling the primary provider first,
        and falling back to active secondary providers if failures occur.
        Returns (parsed_json_dict, successful_provider_name).
        """
        result, provider_name, _cached = await self._execute_with_failover(
            "generate_json", prompt, schema=schema, temperature=temperature, **kwargs
        )
        return result, provider_name

    async def _execute_with_failover(
        self, method_name: str, *args, **kwargs
    ) -> Tuple[Any, str, bool]:
        primary = settings.PRIMARY_AI_PROVIDER
        fallbacks = settings.ACTIVE_FALLBACK_PROVIDERS

        # Build list of unique providers in priority order
        providers_chain = [primary]
        for f in fallbacks:
            if f not in providers_chain:
                providers_chain.append(f)

        prompt = kwargs.get("prompt") or (args[0] if args else "")
        temperature = kwargs.get("temperature", 0.7)

        errors = []
        for provider_name in providers_chain:
            cb = get_circuit_breaker(provider_name)

            if not await cb.allow_request():
                errors.append(
                    {"provider": provider_name, "reason": "circuit_open"}
                )
                continue

            try:
                provider = get_provider(provider_name)
            except AIProviderError as e:
                # Safe skip if the provider registration fails or has missing credentials
                errors.append(
                    {
                        "provider": provider_name,
                        "reason": f"instantiation_failed: {str(e)}",
                    }
                )
                continue

            extra_kwargs = {
                k: v for k, v in kwargs.items()
                if k not in ("prompt", "temperature", "model")
            }
            c_key = cache_key(
                provider=provider_name,
                model=provider.model_name,
                prompt=prompt,
                temperature=temperature,
                **extra_kwargs,
            )
            # 1. Check TTL Cache (In-Memory + Redis)
            try:
                cached_val = await get_cached(c_key)
                if cached_val is not None:
                    logger.info(
                        f"AI response cache hit for provider '{provider_name}'."
                    )
                    return cached_val, provider.provider_name, True
            except Exception as e:
                logger.warning(
                    f"Cache read failed for key '{c_key}': {str(e)}"
                )

            # 2. Call Provider on Cache Miss
            try:
                func = getattr(provider, method_name, None)
                if func is None:
                    errors.append(
                        {
                            "provider": provider_name,
                            "reason": f"{method_name} not supported by this provider",
                        }
                    )
                    continue
                result = await func(*args, **kwargs)
                await cb.record_success()

                # 3. Cache Result on Success
                if result is not None:
                    try:
                        await set_cached(c_key, result)
                    except Exception as e:
                        logger.warning(
                            f"Cache write failed for key '{c_key}': {str(e)}"
                        )

                return result, provider.provider_name, False

            except ProviderAPIError as e:
                # 413 Entity Too Large is unrecoverable, propagate immediately without failover
                if e.status_code == 413:
                    raise

                await cb.record_failure()
                logger.warning(
                    f"AI provider '{provider_name}' call failed during failover: {str(e)}"
                )
                errors.append({"provider": provider_name, "reason": str(e)})
            except AIProviderError as e:
                await cb.record_failure()
                logger.warning(
                    f"AI provider '{provider_name}' call failed during failover: {str(e)}"
                )
                errors.append({"provider": provider_name, "reason": str(e)})

        raise AIProviderError(
            message=f"All AI providers failed. Errors: {errors}",
            provider_name="orchestrator",
        )


ai_orchestrator = AIOrchestrator()