import pytest

from app.core import redis_client


@pytest.mark.asyncio
async def test_connect_redis_requires_redis_url(monkeypatch):
    monkeypatch.setattr(redis_client.settings, "REDIS_URL", None)

    with pytest.raises(
        RuntimeError,
        match="REDIS_URL is required for the AI service",
    ):
        await redis_client.connect_redis()


@pytest.mark.asyncio
async def test_connect_redis_propagates_connection_error(monkeypatch):
    monkeypatch.setattr(
        redis_client.settings,
        "REDIS_URL",
        "redis://redis:6379",
    )

    class MockRedis:
        async def ping(self):
            raise ConnectionError("Redis is unavailable")

    monkeypatch.setattr(
        redis_client.Redis,
        "from_url",
        lambda *args, **kwargs: MockRedis(),
    )

    with pytest.raises(ConnectionError, match="Redis is unavailable"):
        await redis_client.connect_redis()