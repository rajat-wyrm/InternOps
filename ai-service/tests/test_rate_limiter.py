import pytest
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