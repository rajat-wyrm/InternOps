import os
import time
import logging
from typing import Dict, Any, List, Optional, Tuple
from app.core.config import settings
from app.providers.base import BaseAIProvider, AIProviderError, ProviderAPIError
from app.providers.registry import get_provider

logger = logging.getLogger(__name__)

# Circuit breaker parameters (allow override via environment variables)
FAILURE_LIMIT = int(os.getenv("AI_PROVIDER_FAILURE_LIMIT", "3"))
COOLDOWN_SECONDS = float(os.getenv("AI_PROVIDER_COOLDOWN_MS", "300000")) / 1000.0  # Default: 300,000 ms -> 300 s

class CircuitBreaker:
    def __init__(self):
        self.failures = 0
        self.disabled_until: Optional[float] = None

    def is_open(self) -> bool:
        if self.disabled_until is not None:
            if time.time() < self.disabled_until:
                return True
            else:
                # Cooldown expired, transition to CLOSED/probe state
                self.failures = 0
                self.disabled_until = None
        return False

    def record_failure(self):
        self.failures += 1
        if self.failures >= FAILURE_LIMIT:
            self.disabled_until = time.time() + COOLDOWN_SECONDS

    def record_success(self):
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
    - Uses PRIMARY_AI_PROVIDER and ACTIVE_FALLBACK_PROVIDERS
    """

    async def generate_text(
        self,
        prompt: str,
        temperature: float = 0.7,
        **kwargs,
    ) -> str:
        content, _ = await self.generate_text_with_fallback(prompt, temperature=temperature, **kwargs)
        return content

    async def generate_json(
        self,
        prompt: str,
        schema: Dict[str, Any],
        temperature: float = 0.2,
        **kwargs,
    ) -> Dict[str, Any]:
        data, _ = await self.generate_json_with_fallback(prompt, schema=schema, temperature=temperature, **kwargs)
        return data

    async def generate_text_with_fallback(
        self,
        prompt: str,
        temperature: float = 0.7,
        **kwargs,
    ) -> Tuple[str, str]:
        """
        Attempts to generate text by calling the primary provider first,
        and falling back to active secondary providers if failures occur.
        Returns (generated_text, successful_provider_name).
        """
        return await self._execute_with_failover(
            "generate_text",
            prompt,
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
        return await self._execute_with_failover(
            "generate_json",
            prompt,
            schema=schema,
            temperature=temperature,
            **kwargs
        )

    async def _execute_with_failover(self, method_name: str, *args, **kwargs) -> Tuple[Any, str]:
        primary = settings.PRIMARY_AI_PROVIDER
        fallbacks = settings.ACTIVE_FALLBACK_PROVIDERS

        # Build list of unique providers in priority order
        providers_chain = [primary]
        for f in fallbacks:
            if f not in providers_chain:
                providers_chain.append(f)

        errors = []
        for provider_name in providers_chain:
            cb = get_circuit_breaker(provider_name)

            if cb.is_open():
                errors.append({
                    "provider": provider_name,
                    "reason": "circuit_open"
                })
                continue

            try:
                provider = get_provider(provider_name)
            except AIProviderError as e:
                # Safe skip if the provider registration fails or has missing credentials
                errors.append({
                    "provider": provider_name,
                    "reason": f"instantiation_failed: {str(e)}"
                })
                continue

            try:
                func = getattr(provider, method_name)
                result = await func(*args, **kwargs)
                cb.record_success()
                return result, provider.provider_name
            except Exception as e:
                # 413 Entity Too Large is unrecoverable, propagate immediately without failover
                if isinstance(e, ProviderAPIError) and e.status_code == 413:
                    raise

                cb.record_failure()
                logger.warning(f"AI provider '{provider_name}' call failed during failover: {str(e)}")
                errors.append({
                    "provider": provider_name,
                    "reason": str(e)
                })

        raise AIProviderError(
            message=f"All AI providers failed. Errors: {errors}",
            provider_name="orchestrator"
        )

ai_orchestrator = AIOrchestrator()
