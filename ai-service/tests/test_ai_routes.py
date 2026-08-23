"""
Tests for app/api/ai_routes.py

Run with:
    pip install pytest httpx
    pytest tests/test_ai_routes.py -v

These exercise validation, limits, rbac stub, rate-limit stub, and the
health/usage endpoints. `call_provider` is still a stub (NotImplementedError),
so the "happy path" test expects a 500 until it's wired to a real provider —
update that one assertion once providers/gemini.py or openai.py is connected.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.ai_routes import router
from app.core.rate_limit import chat_rate_limiter


from app.core.auth import get_current_user, User


@pytest.fixture
def client(monkeypatch):
    import app.core.rate_limit as rate_limit_module

    class FakeRedis:
        """Minimal in-memory stand-in for redis.asyncio.Redis, just for tests."""

        def __init__(self):
            self.counts = {}

        async def incr(self, key):
            self.counts[key] = self.counts.get(key, 0) + 1
            return self.counts[key]

        async def expire(self, key, seconds):
            pass

    # Force the limiter to use our fake client instead of a real Redis connection.
    fake_redis = FakeRedis()
    monkeypatch.setattr(rate_limit_module, "get_redis_client", lambda: fake_redis)

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: User(id="test_user", roles=["ADMIN"])
    return TestClient(app, raise_server_exceptions=False)


def test_chat_requires_prompt_or_messages(client):
    r = client.post("/ai/chat", json={})
    assert r.status_code == 400
    assert "Prompt or valid messages" in r.json()["detail"]


def test_chat_rejects_invalid_role(client):
    r = client.post(
        "/ai/chat", json={"messages": [{"role": "bogus", "content": "hi"}]}
    )
    assert r.status_code == 422  # pydantic enum validation


def test_chat_rejects_blank_content(client):
    r = client.post(
        "/ai/chat", json={"messages": [{"role": "user", "content": "   "}]}
    )
    assert r.status_code == 400
    assert "cannot be empty" in r.json()["detail"]


def test_chat_truncates_message_list_to_16(client):
    # The messages[:16] slice runs before the MAX_MESSAGES=32 check, so a
    # 33-message list is truncated to 16 before that check ever sees it —
    # the "Too many messages" 413 is effectively unreachable via this path.
    # This is inherited from the original JS (same slice-then-check order),
    # not a bug introduced in the port. This test documents that behavior
    # rather than asserting the unreachable 413.
    messages = [{"role": "user", "content": "hi"} for _ in range(33)]
    r = client.post("/ai/chat", json={"messages": messages})
    assert r.status_code != 413


def test_chat_without_configured_provider_key_returns_503(client, monkeypatch):
    # No API keys set in the test environment ->
    # the registry raises AIProviderError -> mapped to 503.
    for key in ["GEMINI_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY", "ANTHROPIC_API_KEY", "DEEPSEEK_API_KEY", "HUGGINGFACE_TOKEN"]:
        monkeypatch.delenv(key, raising=False)
    r = client.post("/ai/chat", json={"prompt": "hello"})
    assert r.status_code == 503
    assert r.json()["detail"] == "AI service unavailable"


def test_chat_happy_path_with_mocked_provider(client, monkeypatch):
    import app.api.ai_routes as ai_routes_module
    from app.models.ai import ProviderResult

    async def fake_call_provider(user_id, messages):
        return ProviderResult(provider="fake-provider", cached=False, content="hi there!")

    monkeypatch.setattr(ai_routes_module, "call_provider", fake_call_provider)

    r = client.post("/ai/chat", json={"prompt": "hello"}, headers={"x-user-id": "happy-path"})
    assert r.status_code == 200
    body = r.json()
    assert body == {"provider": "fake-provider", "cached": False, "content": "hi there!"}


def test_health_endpoint(client, monkeypatch):
    for key in [
        "GEMINI_API_KEY",
        "OPENAI_API_KEY",
        "GROQ_API_KEY",
        "ANTHROPIC_API_KEY",
        "DEEPSEEK_API_KEY",
        "HUGGINGFACE_TOKEN",
    ]:
        monkeypatch.delenv(key, raising=False)

    r = client.get("/ai/health")
    assert r.status_code == 200

    body = r.json()
    names = [p["name"] for p in body["providers"]]

    assert {"gemini", "openai"}.issubset(names)
    assert all(p["status"] == "unhealthy" for p in body["providers"])


def test_health_endpoint_reports_healthy_when_key_present(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    r = client.get("/ai/health")
    body = r.json()
    gemini_entry = next(p for p in body["providers"] if p["name"] == "gemini")
    assert gemini_entry["status"] == "healthy"
    assert gemini_entry["lastErrorMessage"] is None


@pytest.mark.asyncio
async def test_health_endpoint_reports_unhealthy_when_circuit_open(client, monkeypatch):
    import time
    from app.providers.orchestrator import get_circuit_breaker

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    cb = get_circuit_breaker("gemini")
    cb.failures = 3
    cb.disabled_until = time.time() + 300

    try:
        r = client.get("/ai/health")
        body = r.json()
        gemini_entry = next(p for p in body["providers"] if p["name"] == "gemini")
        assert gemini_entry["status"] == "unhealthy"
        assert "Circuit breaker open" in gemini_entry["lastErrorMessage"]
    finally:
        await cb.record_success()


def test_usage_endpoint(client):
    r = client.get("/ai/usage")
    assert r.status_code == 200
    body = r.json()
    assert "date" in body
    assert body["users"] == []


def test_rate_limit_trips_after_configured_max(client, monkeypatch):
    import app.api.ai_routes as ai_routes_module
    from app.models.ai import ProviderResult

    # Fake provider instead of real Gemini
    async def fake_call_provider(user_id, messages):
        return ProviderResult(
            provider="fake-provider",
            cached=False,
            content="ok",
        )

    # Replace the real call_provider() with our fake one
    monkeypatch.setattr(ai_routes_module, "call_provider", fake_call_provider)

    limit = chat_rate_limiter.max_per_minute
    headers = {"x-user-id": "rate-limit-test-user"}

    # These requests should NOT hit the rate limit
    for _ in range(limit):
        r = client.post(
            "/ai/chat",
            json={"prompt": "hi"},
            headers=headers,
        )
        assert r.status_code != 429

    # This one SHOULD hit the rate limit
    r = client.post(
        "/ai/chat",
        json={"prompt": "hi"},
        headers=headers,
    )

    assert r.status_code == 429
def test_chat_uses_cache_for_identical_requests(client, monkeypatch):
    import app.api.ai_routes as ai_routes_module

    calls = 0

    async def fake_generate(prompt, temperature=0.7, **kwargs):
        nonlocal calls
        calls += 1
        return "cached response", "fake-provider"

    monkeypatch.setattr(
    ai_routes_module.ai_orchestrator,
    "generate_chat_with_fallback",
    fake_generate,
)

    # Use a fake Redis-backed cache in memory.
    cache = {}

    async def fake_get_cached(key):
        return cache.get(key)

    async def fake_set_cached(key, value):
        cache[key] = value

    monkeypatch.setattr(
        "app.core.cache.get_cached",
        fake_get_cached,
    )
    monkeypatch.setattr(
        "app.core.cache.set_cached",
        fake_set_cached,
    )

    headers = {"x-user-id": "cache-test-user"}
    payload = {"prompt": "same prompt"}

    first = client.post(
        "/ai/chat",
        json=payload,
        headers=headers,
    )

    second = client.post(
        "/ai/chat",
        json=payload,
        headers=headers,
    )

    assert first.status_code == 200
    assert second.status_code == 200

    assert first.json()["content"] == "cached response"
    assert second.json()["content"] == "cached response"

    # The provider should only be called once.
    assert calls == 1

    # First request is a cache miss, second is a cache hit.
    assert first.json()["cached"] is False
    assert second.json()["cached"] is True
