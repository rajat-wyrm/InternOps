"""
Rate limiting compatibility module.

The RateLimiter implementation lives in rate_limiter.py.
This module keeps the existing enforce_rate_limit dependency
used by the AI chat endpoint.
"""

from fastapi import Depends, Request
from .auth import User, get_current_user
from .config import REDIS_URL
from .rate_limiter import RateLimiter

def get_redis_client():
    from . import rate_limiter

    return rate_limiter.redis_client
headers = {"x-user-id": "rate-limit-test-user"}

async def enforce_rate_limit(
    request: Request,
    user: User = Depends(get_current_user),
) -> None:
    from . import rate_limiter

    # Use the Redis client supplied by this compatibility module.
    rate_limiter.redis_client = get_redis_client()
    await chat_rate_limiter.check_rate_limit(
        request=request,
        current_user=user,
    )
    
ai_rate_limiter = RateLimiter()
chat_rate_limiter = RateLimiter()