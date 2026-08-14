import pytest
from unittest.mock import AsyncMock, patch
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
    """Test the in-memory fallback logic"""
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
@patch("app.core.rate_limiter.redis_client", new_callable=AsyncMock)
async def test_rate_limiter_blocks_with_redis(mock_redis):
    """Test the Redis fixed-window logic"""
    limiter = RateLimiter(requests_per_minute=2)
    request = DummyRequest()

    # Make the mock Redis pretend the counter is at 3 (over the limit of 2)
    mock_redis.incr.return_value = 3

    with pytest.raises(HTTPException):
        await limiter.check_rate_limit(request)

    # Verify that the new code's correct Redis method was called
    mock_redis.incr.assert_called_once()
