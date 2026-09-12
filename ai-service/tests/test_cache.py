import time
import pytest

from app.core.cache import cache_key, clear_cache, get_cached, set_cached, get_or_set
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.ai_routes import router
from app.core.auth import get_current_user, User


@pytest.fixture(autouse=True)
def clean_in_memory_cache():
    clear_cache()
    yield
    clear_cache()


def test_cache_key_changes_with_prompt():
    key1 = cache_key(
        provider="gemini",
        model="gemini-2.0-flash",
        prompt="Hello",
        temperature=0.7,
    )

    key2 = cache_key(
        provider="gemini",
        model="gemini-2.0-flash",
        prompt="Hello world",
        temperature=0.7,
    )

    assert key1 != key2


def test_cache_key_changes_with_model():
    key1 = cache_key(
        provider="gemini",
        model="gemini-2.0-flash",
        prompt="Hello",
        temperature=0.7,
    )

    key2 = cache_key(
        provider="gemini",
        model="gemini-1.5-flash",
        prompt="Hello",
        temperature=0.7,
    )

    assert key1 != key2


def test_cache_key_changes_with_temperature():
    key1 = cache_key(
        provider="gemini",
        model="gemini-2.0-flash",
        prompt="Hello",
        temperature=0.7,
    )

    key2 = cache_key(
        provider="gemini",
        model="gemini-2.0-flash",
        prompt="Hello",
        temperature=0.2,
    )

    assert key1 != key2


def test_cache_key_deterministic_and_case_insensitive():
    key1 = cache_key(provider="Gemini", model="GEMINI-2.0-FLASH", prompt="Hello", temperature=0.7)
    key2 = cache_key(provider="gemini", model="gemini-2.0-flash", prompt="Hello", temperature=0.7)
    assert key1 == key2


def test_cache_key_kwarg_canonicalization():
    key1 = cache_key("gemini", "m1", "prompt", 0.7, b=2, a=1)
    key2 = cache_key("gemini", "m1", "prompt", 0.7, a=1, b=2)
    assert key1 == key2


@pytest.mark.asyncio
async def test_get_or_set_cache_miss_then_hit(monkeypatch):
    cache = {}

    async def fake_get_cached(key):
        return cache.get(key)

    async def fake_set_cached(key, value, *args, **kwargs):
        cache[key] = value

    monkeypatch.setattr("app.core.cache.get_cached", fake_get_cached)
    monkeypatch.setattr("app.core.cache.set_cached", fake_set_cached)

    calls = 0

    async def compute():
        nonlocal calls
        calls += 1
        return "AI response"

    key = cache_key(
        provider="gemini",
        model="gemini-2.0-flash",
        prompt="Hello",
        temperature=0.7,
    )

    result1, cached1 = await get_or_set(key, compute)

    result2, cached2 = await get_or_set(key, compute)

    assert result1 == "AI response"
    assert result2 == "AI response"

    assert cached1 is False
    assert cached2 is True

    assert calls == 1


@pytest.mark.asyncio
async def test_in_memory_ttl_expiration():
    key = "test:ttl:key"
    await set_cached(key, "temp_data", ttl=1)
    assert await get_cached(key) == "temp_data"

    # Simulate 2 seconds passing
    future_time = time.time() + 2.0
    import app.core.cache as cache_module
    old_time = time.time
    try:
        monkeypatch_time = lambda: future_time
        time.time = monkeypatch_time
        cache_module.time.time = monkeypatch_time
        assert await get_cached(key) is None
    finally:
        time.time = old_time
        cache_module.time.time = old_time


@pytest.mark.asyncio
async def test_falsy_cached_response_is_hit():
    key = "test:falsy:key"
    await set_cached(key, "")
    val = await get_cached(key)
    assert val == ""

    calls = 0

    async def compute():
        nonlocal calls
        calls += 1
        return "new value"

    res, cached = await get_or_set(key, compute)
    assert res == ""
    assert cached is True
    assert calls == 0


@pytest.mark.asyncio
async def test_provider_failure_not_cached():
    key = "test:failure:key"
    calls = 0

    async def failing_compute():
        nonlocal calls
        calls += 1
        raise ValueError("Provider down")

    with pytest.raises(ValueError, match="Provider down"):
        await get_or_set(key, failing_compute)

    assert calls == 1
    assert await get_cached(key) is None


def test_ai_route_integration_cache_hit_and_miss(monkeypatch):
    import app.api.ai_routes as ai_routes_module
    from app.core.rate_limiter import chat_rate_limiter

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: User(id="integration_user", roles=["ADMIN"])
    app.dependency_overrides[chat_rate_limiter.check_rate_limit] = lambda: None
    client = TestClient(app)

    calls = 0

    async def mock_generate_chat(messages, temperature=0.7, **kwargs):
        nonlocal calls
        calls += 1
        return f"Response #{calls}", "mock-provider"

    monkeypatch.setattr(
        ai_routes_module.ai_orchestrator,
        "generate_chat_with_fallback",
        mock_generate_chat,
    )

    payload = {"prompt": "Integration test prompt"}

    # First request: Cache MISS
    resp1 = client.post("/ai/chat", json=payload)
    assert resp1.status_code == 200
    b1 = resp1.json()
    assert b1["content"] == "Response #1"
    assert b1["cached"] is False
    assert calls == 1

    # Second request: Cache HIT
    resp2 = client.post("/ai/chat", json=payload)
    assert resp2.status_code == 200
    b2 = resp2.json()
    assert b2["content"] == "Response #1"
    assert b2["cached"] is True
    assert calls == 1


@pytest.mark.asyncio
async def test_set_cached_uses_configured_ttl(monkeypatch):
    calls = {}

    class FakeRedis:
        async def set(self, key, value, ex=None):
            calls["key"] = key
            calls["value"] = value
            calls["ttl"] = ex

    monkeypatch.setattr(
        "app.core.cache.get_redis",
        lambda: FakeRedis(),
    )

    monkeypatch.setattr(
        "app.core.cache.settings.AI_CACHE_TTL",
        300,
    )

    await set_cached(
        "test-key",
        {"response": "hello"},
    )

    assert calls["key"] == "test-key"
    assert calls["value"] == '{"response": "hello"}'
    assert calls["ttl"] == 300
