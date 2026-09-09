import pytest
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
from fastapi.testclient import TestClient
import redis.asyncio as redis

from app.core.auth import User, get_current_user
from app.core.rate_limiter import RateLimiter, ai_rate_limiter, chat_rate_limiter
from app.main import app

class DummyClient:
    host = "127.0.0.1"

class DummyRequest:
    def __init__(self):
        self.headers = {}
        self.client = DummyClient()

@pytest.mark.asyncio
@patch("app.core.rate_limiter.get_redis")
async def test_rate_limiter_blocks_with_redis(mock_get_redis):
    """Test the Redis fixed-window logic"""
    limiter = RateLimiter(requests_per_minute=2)
    request = DummyRequest()
    
    mock_redis = AsyncMock()
    mock_get_redis.return_value = mock_redis

    # Make the mock Redis pretend the counter is at 3 (over the limit of 2)
    mock_redis.incr.return_value = 3

    with pytest.raises(HTTPException) as exc:
        await limiter.check_rate_limit(request)
    
    assert exc.value.status_code == 429
    # Verify that the new code's correct Redis method was called
    mock_redis.incr.assert_called_once()

@pytest.mark.asyncio
@patch("app.core.rate_limiter.get_redis")
async def test_rate_limiter_fails_closed_when_redis_unavailable(mock_get_redis):
    """Verify that if Redis is None (not configured) or throws an error, we fail closed."""
    limiter = RateLimiter(requests_per_minute=2)
    request = DummyRequest()
    
    # 1. Redis is None
    mock_get_redis.return_value = None
    with pytest.raises(HTTPException) as exc:
        await limiter.check_rate_limit(request)
    assert exc.value.status_code == 503
    assert exc.value.detail == "Rate limiter unavailable"

    # 2. Redis throws error
    mock_redis = AsyncMock()
    mock_redis.incr.side_effect = redis.RedisError("Connection failed")
    mock_get_redis.return_value = mock_redis
    
    with pytest.raises(HTTPException) as exc:
        await limiter.check_rate_limit(request)
    assert exc.value.status_code == 503
    assert exc.value.detail == "Rate limiter unavailable"
