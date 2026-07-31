import os
import sys
import time
import pytest
from typing import Dict, Any
from app.providers.base import BaseAIProvider, AIProviderError, ProviderAPIError, ProviderRateLimitError, ProviderTimeoutError
from app.providers.orchestrator import AIOrchestrator, get_circuit_breaker, _circuit_breakers
from app.core.config import settings

# Ensure ai-service root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

@pytest.fixture(autouse=True)
def reset_circuit_breakers():
    _circuit_breakers.clear()
    yield
    _circuit_breakers.clear()

class MockProvider(BaseAIProvider):
    def __init__(self, name: str, fail_with: Exception = None, return_val: str = None):
        super().__init__(api_key="mock-key", model_name="mock-model")
        self._name = name
        self.fail_with = fail_with
        self.return_val = return_val
        self.calls = 0

    @property
    def provider_name(self) -> str:
        return self._name

    async def generate_text(self, prompt: str, temperature: float = 0.7, **kwargs) -> str:
        self.calls += 1
        if self.fail_with:
            raise self.fail_with
        return self.return_val or f"Response from {self._name}"

    async def generate_json(self, prompt: str, schema: Dict[str, Any], temperature: float = 0.2, **kwargs) -> Dict[str, Any]:
        self.calls += 1
        if self.fail_with:
            raise self.fail_with
        return {"response": self.return_val or self._name}

@pytest.mark.asyncio
async def test_orchestrator_success_primary(monkeypatch):
    monkeypatch.setattr(settings, "PRIMARY_AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "ACTIVE_FALLBACK_PROVIDERS", ["openai"])

    providers = {
        "gemini": MockProvider("gemini"),
        "openai": MockProvider("openai"),
    }
    monkeypatch.setattr("app.providers.orchestrator.get_provider", lambda name: providers[name])

    orchestrator = AIOrchestrator()
    content, provider_name = await orchestrator.generate_text_with_fallback("test prompt")

    assert content == "Response from gemini"
    assert provider_name == "gemini"
    assert providers["gemini"].calls == 1
    assert providers["openai"].calls == 0

    # Circuit breaker remains healthy
    cb = get_circuit_breaker("gemini")
    assert cb.failures == 0
    assert not await cb.is_open()

@pytest.mark.asyncio
async def test_orchestrator_failover_to_fallback(monkeypatch):
    monkeypatch.setattr(settings, "PRIMARY_AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "ACTIVE_FALLBACK_PROVIDERS", ["openai"])

    providers = {
        "gemini": MockProvider("gemini", fail_with=ProviderTimeoutError("Timeout", "gemini")),
        "openai": MockProvider("openai"),
    }
    monkeypatch.setattr("app.providers.orchestrator.get_provider", lambda name: providers[name])

    orchestrator = AIOrchestrator()
    content, provider_name = await orchestrator.generate_text_with_fallback("test prompt")

    assert content == "Response from openai"
    assert provider_name == "openai"
    assert providers["gemini"].calls == 1
    assert providers["openai"].calls == 1

    # Gemini failure recorded
    cb_gemini = get_circuit_breaker("gemini")
    assert cb_gemini.failures == 1
    assert not await cb_gemini.is_open()

    # OpenAI success recorded/maintained
    cb_openai = get_circuit_breaker("openai")
    assert cb_openai.failures == 0

@pytest.mark.asyncio
async def test_orchestrator_circuit_breaker_trips_and_bypasses(monkeypatch):
    monkeypatch.setattr(settings, "PRIMARY_AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "ACTIVE_FALLBACK_PROVIDERS", ["openai"])

    providers = {
        "gemini": MockProvider("gemini", fail_with=ProviderRateLimitError("Rate limit", "gemini")),
        "openai": MockProvider("openai"),
    }
    monkeypatch.setattr("app.providers.orchestrator.get_provider", lambda name: providers[name])

    orchestrator = AIOrchestrator()
    cb_gemini = get_circuit_breaker("gemini")

    # Trigger 3 failures to trip the circuit breaker (FAILURE_LIMIT = 3)
    for i in range(3):
        content, provider_name = await orchestrator.generate_text_with_fallback("test")
        assert provider_name == "openai"
        assert providers["gemini"].calls == i + 1

    # Circuit breaker should now be OPEN
    assert await cb_gemini.is_open()
    assert cb_gemini.failures == 3

    # 4th call should bypass gemini entirely
    content, provider_name = await orchestrator.generate_text_with_fallback("test")
    assert provider_name == "openai"
    assert providers["gemini"].calls == 3  # Gemini calls did not increase
    assert providers["openai"].calls == 4

@pytest.mark.asyncio
async def test_orchestrator_circuit_breaker_half_open_recovery(monkeypatch):
    monkeypatch.setattr(settings, "PRIMARY_AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "ACTIVE_FALLBACK_PROVIDERS", ["openai"])

    # First, trip the circuit
    gemini_mock = MockProvider("gemini", fail_with=ProviderRateLimitError("Rate limit", "gemini"))
    providers = {
        "gemini": gemini_mock,
        "openai": MockProvider("openai"),
    }
    monkeypatch.setattr("app.providers.orchestrator.get_provider", lambda name: providers[name])

    orchestrator = AIOrchestrator()
    cb_gemini = get_circuit_breaker("gemini")

    for _ in range(3):
        await orchestrator.generate_text_with_fallback("test")

    assert await cb_gemini.is_open()

    # Make gemini healthy
    gemini_mock.fail_with = None

    # Simulate cooldown expiration by mocking time.time()
    future_time = time.time() + 301.0
    monkeypatch.setattr(time, "time", lambda: future_time)

    # Cooldown should be expired, meaning circuit breaker is no longer open (probe/half-open)
    assert not await cb_gemini.is_open()

    # Next call should attempt primary again, succeed, and reset failure counts
    content, provider_name = await orchestrator.generate_text_with_fallback("test")
    assert provider_name == "gemini"
    assert content == "Response from gemini"
    assert cb_gemini.failures == 0
    assert not await cb_gemini.is_open()

@pytest.mark.asyncio
async def test_orchestrator_all_providers_failed(monkeypatch):
    monkeypatch.setattr(settings, "PRIMARY_AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "ACTIVE_FALLBACK_PROVIDERS", ["openai"])

    providers = {
        "gemini": MockProvider("gemini", fail_with=ProviderRateLimitError("Rate limit", "gemini")),
        "openai": MockProvider("openai", fail_with=ProviderTimeoutError("Timeout", "openai")),
    }
    monkeypatch.setattr("app.providers.orchestrator.get_provider", lambda name: providers[name])

    orchestrator = AIOrchestrator()

    with pytest.raises(AIProviderError, match="All AI providers failed"):
        await orchestrator.generate_text_with_fallback("test")

    assert providers["gemini"].calls == 1
    assert providers["openai"].calls == 1

@pytest.mark.asyncio
async def test_orchestrator_unrecoverable_error_bypasses_failover(monkeypatch):
    monkeypatch.setattr(settings, "PRIMARY_AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "ACTIVE_FALLBACK_PROVIDERS", ["openai"])

    # 413 response status represents unrecoverable payload size limit error
    unrecoverable_err = ProviderAPIError("Payload too large", "gemini", status_code=413)

    providers = {
        "gemini": MockProvider("gemini", fail_with=unrecoverable_err),
        "openai": MockProvider("openai"),
    }
    monkeypatch.setattr("app.providers.orchestrator.get_provider", lambda name: providers[name])

    orchestrator = AIOrchestrator()

    with pytest.raises(ProviderAPIError) as exc_info:
        await orchestrator.generate_text_with_fallback("test")

    assert exc_info.value.status_code == 413
    assert providers["gemini"].calls == 1
    assert providers["openai"].calls == 0  # Secondary was NOT tried

@pytest.mark.asyncio
async def test_orchestrator_generate_json_fallback(monkeypatch):
    monkeypatch.setattr(settings, "PRIMARY_AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "ACTIVE_FALLBACK_PROVIDERS", ["openai"])

    providers = {
        "gemini": MockProvider("gemini", fail_with=ProviderTimeoutError("Timeout", "gemini")),
        "openai": MockProvider("openai"),
    }
    monkeypatch.setattr("app.providers.orchestrator.get_provider", lambda name: providers[name])

    orchestrator = AIOrchestrator()
    result, provider_name = await orchestrator.generate_json_with_fallback("prompt", schema={})

    assert result == {"response": "openai"}
    assert provider_name == "openai"
