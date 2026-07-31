import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

from app.core.rate_limiter import RateLimiter


class DummyClient:
    host = "127.0.0.1"


class DummyRequest:
    def __init__(self):
        self.headers = {}
        self.client = DummyClient()


@pytest.mark.asyncio
async def test_rate_limiter_blocks_after_limit():
    limiter = RateLimiter(requests_per_minute=2)
    request = DummyRequest()

    # First request -> allowed
    await limiter.check_rate_limit(request)

    # Second request -> allowed
    await limiter.check_rate_limit(request)

    # Third request -> blocked
    with pytest.raises(HTTPException):
        await limiter.check_rate_limit(request)
        
@pytest.mark.asyncio
async def test_rate_limiter_blocks_with_redis():
    limiter = RateLimiter(
        requests_per_minute=2,
        redis_url="redis://localhost:6379",
    )

    mock_pipe = MagicMock()
    mock_pipe.execute = AsyncMock(
        return_value=[0, 1, 3, True]
    )

    mock_redis = MagicMock()
    mock_redis.pipeline.return_value.__aenter__.return_value = mock_pipe

    limiter.redis_client = mock_redis

    request = MagicMock()
    request.headers = {"X-User-ID": "user123"}
    request.client = None

    with pytest.raises(HTTPException):
        await limiter.check_rate_limit(request)

    mock_pipe.zremrangebyscore.assert_called_once()
    mock_pipe.zadd.assert_called_once()
    mock_pipe.zcard.assert_called_once()
    mock_pipe.expire.assert_called_once()