import pytest

from app.core.cache import cache_key, get_or_set


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


@pytest.mark.asyncio
async def test_get_or_set_cache_miss_then_hit(monkeypatch):
    cache = {}

    async def fake_get_cached(key):
        return cache.get(key)

    async def fake_set_cached(key, value):
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