import os
import sys
import time
import asyncio
import pytest
from pydantic import ValidationError
from typing import Dict, Any

from app.core.config import Settings
from app.providers.base import BaseAIProvider, AIProviderError, ProviderAPIError, ProviderTimeoutError
from app.providers.orchestrator import AIOrchestrator, get_circuit_breaker, _circuit_breakers
from app.core.config import settings

@pytest.fixture(autouse=True)
def clean_circuit_breakers():
    _circuit_breakers.clear()
    yield
    _circuit_breakers.clear()

class FaultyMockProvider(BaseAIProvider):
    def __init__(self, name: str, fail_with: Exception = None, return_val: str = None):
        super().__init__(api_key="mock-key", model_name="mock-model")
        self._name = name
        self.fail_with = fail_with
        self.return_val = return_val
        self.calls = 0

    @property
    def provider_name(self) -> str:
        return self._name

    async def generate_chat(self, messages: list[dict], temperature: float = 0.7, **kwargs) -> str:
        self.calls += 1
        if self.fail_with is not None:
            raise self.fail_with
        return self.return_val or f"Response from {self._name}"

    async def generate_json(self, prompt: str, schema: Dict[str, Any], temperature: float = 0.2, **kwargs) -> Dict[str, Any]:
        self.calls += 1
        if self.fail_with is not None:
            raise self.fail_with
        return {"response": self.return_val or self._name}

# ==============================================================================
# Configuration Tests
# ==============================================================================

def test_settings_validation_invalid_limit():
    # Test that negative or 0 failure limit is rejected
    with pytest.raises(ValidationError) as exc:
        Settings(AI_PROVIDER_FAILURE_LIMIT=0)
    assert "AI_PROVIDER_FAILURE_LIMIT must be greater than 0" in str(exc.value)

    with pytest.raises(ValidationError) as exc:
        Settings(AI_PROVIDER_FAILURE_LIMIT=-5)
    assert "AI_PROVIDER_FAILURE_LIMIT must be greater than 0" in str(exc.value)

    with pytest.raises(ValidationError) as exc:
        Settings(AI_PROVIDER_FAILURE_LIMIT="invalid")
    assert "AI_PROVIDER_FAILURE_LIMIT must be a valid integer" in str(exc.value)

def test_settings_validation_invalid_cooldown():
    # Test that negative or 0 cooldown limit is rejected
    with pytest.raises(ValidationError) as exc:
        Settings(AI_PROVIDER_COOLDOWN_MS=0)
    assert "AI_PROVIDER_COOLDOWN_MS must be greater than 0" in str(exc.value)

    with pytest.raises(ValidationError) as exc:
        Settings(AI_PROVIDER_COOLDOWN_MS=-100)
    assert "AI_PROVIDER_COOLDOWN_MS must be greater than 0" in str(exc.value)

    with pytest.raises(ValidationError) as exc:
        Settings(AI_PROVIDER_COOLDOWN_MS="invalid")
    assert "AI_PROVIDER_COOLDOWN_MS must be a valid number" in str(exc.value)

def test_settings_validation_valid(monkeypatch):
    monkeypatch.setenv("PRIMARY_AI_PROVIDER", "gemini")
    monkeypatch.setenv("FALLBACK_AI_PROVIDERS", "groq,openai")
    cfg = Settings(PRIMARY_AI_PROVIDER="gemini", GEMINI_API_KEY="valid_key", AI_PROVIDER_FAILURE_LIMIT="5", AI_PROVIDER_COOLDOWN_MS="60000")
    assert cfg.AI_PROVIDER_FAILURE_LIMIT == 5
    assert cfg.AI_PROVIDER_COOLDOWN_MS == 60000.0

# ==============================================================================
# Exception Handling & Failover Propagation Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_recoverable_errors_trigger_failover(monkeypatch):
    monkeypatch.setattr(settings, "PRIMARY_AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "ACTIVE_FALLBACK_PROVIDERS", ["openai"])

    # Timeout error is a recoverable provider error
    providers = {
        "gemini": FaultyMockProvider("gemini", fail_with=ProviderTimeoutError("timeout", "gemini")),
        "openai": FaultyMockProvider("openai", return_val="success-fallback"),
    }
    monkeypatch.setattr("app.providers.orchestrator.get_provider", lambda name: providers[name])

    orchestrator = AIOrchestrator()
    content, provider_name = await orchestrator.generate_chat_with_fallback([{"role": "user", "content": "test"}])

    assert content == "success-fallback"
    assert provider_name == "openai"
    # Gemini failure is recorded
    cb_gemini = get_circuit_breaker("gemini")
    assert cb_gemini.failures == 1

@pytest.mark.asyncio
async def test_programming_errors_do_not_trigger_failover(monkeypatch):
    monkeypatch.setattr(settings, "PRIMARY_AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "ACTIVE_FALLBACK_PROVIDERS", ["openai"])

    # ValueError is a programming error, not a provider error
    providers = {
        "gemini": FaultyMockProvider("gemini", fail_with=ValueError("Coding mistake")),
        "openai": FaultyMockProvider("openai", return_val="success-fallback"),
    }
    monkeypatch.setattr("app.providers.orchestrator.get_provider", lambda name: providers[name])

    orchestrator = AIOrchestrator()

    # Should raise ValueError immediately without falling back
    with pytest.raises(ValueError, match="Coding mistake"):
        await orchestrator.generate_chat_with_fallback([{"role": "user", "content": "test"}])

    # OpenAI must NOT have been called
    assert providers["openai"].calls == 0
    # Gemini circuit breaker failures must not increment
    cb_gemini = get_circuit_breaker("gemini")
    assert cb_gemini.failures == 0

@pytest.mark.asyncio
async def test_cancelled_error_propagates_immediately(monkeypatch):
    monkeypatch.setattr(settings, "PRIMARY_AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "ACTIVE_FALLBACK_PROVIDERS", ["openai"])

    providers = {
        "gemini": FaultyMockProvider("gemini", fail_with=asyncio.CancelledError()),
        "openai": FaultyMockProvider("openai", return_val="fallback-val"),
    }
    monkeypatch.setattr("app.providers.orchestrator.get_provider", lambda name: providers[name])

    orchestrator = AIOrchestrator()

    with pytest.raises(asyncio.CancelledError):
        await orchestrator.generate_chat_with_fallback([{"role": "user", "content": "test"}])

    assert providers["openai"].calls == 0
    cb_gemini = get_circuit_breaker("gemini")
    assert cb_gemini.failures == 0

# ==============================================================================
# Circuit Breaker Concurrency & Refined Transition Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_circuit_breaker_exact_trip_limit(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER_FAILURE_LIMIT", 3)
    monkeypatch.setattr(settings, "AI_PROVIDER_COOLDOWN_MS", 300000.0)

    cb = get_circuit_breaker("gemini")

    # After 2 failures, it should remain CLOSED
    await cb.record_failure()
    await cb.record_failure()
    assert cb.failures == 2
    assert not await cb.is_open()
    assert await cb.allow_request() is True

    # 3rd failure trips the circuit
    await cb.record_failure()
    assert cb.failures == 3
    assert await cb.is_open() is True
    assert await cb.allow_request() is False

    # Simulate cooldown expiry
    future_time = time.time() + 301.0
    monkeypatch.setattr(time, "time", lambda: future_time)

    # Pure query returns False, state remains mutated to open until next request attempt
    assert await cb.is_open() is False

    # allow_request performs state transition to Closed
    assert await cb.allow_request() is True
    assert cb.failures == 0
    assert cb.disabled_until is None

@pytest.mark.asyncio
async def test_circuit_breaker_no_lost_failure_increments(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER_FAILURE_LIMIT", 100)
    monkeypatch.setattr(settings, "AI_PROVIDER_COOLDOWN_MS", 100000.0)

    cb = get_circuit_breaker("gemini")

    # Record 50 failures concurrently
    tasks = [cb.record_failure() for _ in range(50)]
    await asyncio.gather(*tasks)

    # Concurrency safe: lock prevents lost updates
    assert cb.failures == 50
    assert not await cb.is_open()

@pytest.mark.asyncio
async def test_circuit_breaker_single_cooldown_reset(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER_FAILURE_LIMIT", 3)
    monkeypatch.setattr(settings, "AI_PROVIDER_COOLDOWN_MS", 300000.0)

    cb = get_circuit_breaker("gemini")

    # Trip breaker
    for _ in range(3):
        await cb.record_failure()
    assert await cb.is_open() is True

    # Simulate cooldown expiry
    future_time = time.time() + 301.0
    monkeypatch.setattr(time, "time", lambda: future_time)

    # We track how many times the transition logic resets failure count by mocking the reset
    original_allow_request = cb.allow_request
    resets_occurred = 0

    async def mock_allow_request():
        nonlocal resets_occurred
        # We acquire lock to inspect state safely
        async with cb._lock:
            # If cooldown is expired and breaker is not reset yet, we increment reset tracker
            if cb.disabled_until is not None and future_time >= cb.disabled_until:
                resets_occurred += 1
        return await original_allow_request()

    cb.allow_request = mock_allow_request

    # Trigger concurrent requests immediately after cooldown expiry
    results = await asyncio.gather(*[cb.allow_request() for _ in range(10)])

    # All concurrent requests should be allowed
    assert all(r is True for r in results)
    # Exactly one request should have performed the logical cooldown reset
    assert resets_occurred == 1
    # Circuit breaker state is fully restored
    assert cb.failures == 0
    assert cb.disabled_until is None

@pytest.mark.asyncio
async def test_circuit_breaker_concurrent_recovery_resets():
    cb = get_circuit_breaker("gemini")
    await cb.record_failure()
    assert cb.failures == 1

    # Record concurrent successes
    tasks = [cb.record_success() for _ in range(10)]
    await asyncio.gather(*tasks)

    assert cb.failures == 0
    assert not await cb.is_open()
    assert cb.disabled_until is None

@pytest.mark.asyncio
async def test_circuit_breaker_repeated_concurrent_recovery():
    cb = get_circuit_breaker("gemini")
    
    # Run repeated concurrent success calls on breaker
    for _ in range(5):
        await cb.record_failure()
        tasks = [cb.record_success() for _ in range(10)]
        await asyncio.gather(*tasks)
        assert cb.failures == 0
        assert cb.disabled_until is None
        assert not await cb.is_open()

# ==============================================================================
# Locking Strategy for is_open() validation
# ==============================================================================

@pytest.mark.asyncio
async def test_is_open_does_not_acquire_lock():
    cb = get_circuit_breaker("gemini")
    
    # We inspect if lock is acquired during is_open()
    # If a lock is held by another task, is_open() can still be called instantly without waiting for lock
    async with cb._lock:
        # Lock is currently locked. Let's call is_open()
        # If is_open() tried to acquire lock, it would block/hang here because lock is held.
        # Since is_open() does not lock, it completes instantly.
        open_status = await asyncio.wait_for(cb.is_open(), timeout=0.1)
        assert open_status is False
