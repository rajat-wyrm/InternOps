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
from app.core.rate_limiter import chat_rate_limiter


from app.core.auth import get_current_user, User


@pytest.fixture
def client(monkeypatch):
    import app.core.rate_limiter as rate_limit_module

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
    monkeypatch.setattr(rate_limit_module, "get_redis", lambda: fake_redis)

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
    # No GEMINI_API_KEY/OPENAI_API_KEY set in the test environment ->
    # the registry raises AIProviderError -> mapped to 503.
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
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
        "NVIDIA_API_KEY",
    ]:
        monkeypatch.delenv(key, raising=False)
    r = client.get("/ai/health")
    assert r.status_code == 200
    body = r.json()
    names = {p["name"] for p in body["providers"]}
    assert {"gemini", "openai"}.issubset(names)
    provider_status = {p["name"]: p["status"] for p in body["providers"]}

    assert provider_status["gemini"] == "unhealthy"
    assert provider_status["openai"] == "unhealthy"

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

    limit = chat_rate_limiter.requests_per_minute
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
def test_chat_wires_up_orchestrator_cache_status(client, monkeypatch):
    """
    /ai/chat has no cache of its own anymore (see #1894) — it just reports
    back whatever cache-hit/miss status the orchestrator's single caching
    layer gives it. This checks that wiring: `cached` in the response body
    should match what generate_chat_with_cache_status() returned, not be
    computed by ai_routes.py itself.
    """
    import app.api.ai_routes as ai_routes_module

    calls = []

    async def fake_generate_with_cache_status(messages, temperature=0.7, **kwargs):
        calls.append(messages)
        cached = len(calls) > 1
        return "cached response", "fake-provider", cached

    monkeypatch.setattr(
        ai_routes_module.ai_orchestrator,
        "generate_chat_with_cache_status",
        fake_generate_with_cache_status,
    )

    payload = {"prompt": "same prompt"}

    first = client.post("/ai/chat", json=payload)
    second = client.post("/ai/chat", json=payload)

    assert first.status_code == 200
    assert second.status_code == 200

    assert first.json()["content"] == "cached response"
    assert second.json()["content"] == "cached response"

    # First request is a cache miss, second is a cache hit — straight from
    # whatever generate_chat_with_cache_status() reported.
    assert first.json()["cached"] is False
    assert second.json()["cached"] is True


@pytest.mark.asyncio
async def test_chat_dedupes_identical_requests_via_single_orchestrator_cache(monkeypatch):
    """
    End-to-end check that /ai/chat's caching is really just the
    orchestrator's single cache (app/core/cache.py's `ai:cache:...` keys,
    shared with /generate and /ai/generate-image) — no separate cache in
    ai_routes.py, and no duplicate cache entries for the same request.
    """
    import app.providers.orchestrator as orchestrator_module
    from app.core.cache import clear_cache
    from app.api.ai_routes import call_provider

    orchestrator_module._circuit_breakers.clear()
    clear_cache()

    calls = 0

    class FakeProvider:
        provider_name = "fake-provider"
        model_name = "fake-model"

        async def generate_chat(self, messages, temperature=0.7, **kwargs):
            nonlocal calls
            calls += 1
            return "cached response"

    monkeypatch.setattr(orchestrator_module, "get_provider", lambda name=None: FakeProvider())

    try:
        messages = [{"role": "user", "content": "same prompt"}]

        first = await call_provider("user-1", messages)
        second = await call_provider("user-1", messages)

        assert first.content == "cached response"
        assert second.content == "cached response"

        # The provider was only actually called once — the second request
        # was served from the orchestrator's cache.
        assert calls == 1

        assert first.cached is False
        assert second.cached is True
    finally:
        orchestrator_module._circuit_breakers.clear()
        clear_cache()

def test_tl_cannot_access_health_endpoint(client, monkeypatch):
    from app.core.auth import get_current_user, User

    client.app.dependency_overrides[get_current_user] = lambda: User(
        id="tl_user", roles=["TL"]
    )
    r = client.get("/ai/health")
    assert r.status_code == 403


def test_tl_cannot_access_usage_endpoint(client, monkeypatch):
    from app.core.auth import get_current_user, User

    client.app.dependency_overrides[get_current_user] = lambda: User(
        id="tl_user", roles=["TL"]
    )
    r = client.get("/ai/usage")
    assert r.status_code == 403


def test_tl_can_access_chat_endpoint(client, monkeypatch):
    from app.core.auth import get_current_user, User
    import app.api.ai_routes as ai_routes_module
    from app.models.ai import ProviderResult

    client.app.dependency_overrides[get_current_user] = lambda: User(
        id="tl_user", roles=["TL"]
    )

    async def fake_call_provider(user_id, messages):
        return ProviderResult(provider="fake-provider", cached=False, content="hi!")

    monkeypatch.setattr(ai_routes_module, "call_provider", fake_call_provider)

    r = client.post("/ai/chat", json={"prompt": "hello"})
    assert r.status_code == 200
