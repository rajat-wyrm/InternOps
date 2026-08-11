"""
Rate limiting.

Uses Redis to store request counts so limits are shared across
multiple worker processes and survive restarts. If Redis is
unreachable, requests are rejected (fail closed) rather than
silently allowing unlimited traffic.
"""

import os

import redis.asyncio as redis
from fastapi import Depends, HTTPException, Request, status

from .auth import User, get_current_user
from .config import REDIS_URL

AI_CHAT_RATE_LIMIT = int(os.getenv("AI_CHAT_RATE_LIMIT_PER_MIN", "10"))
WINDOW_SECONDS = 60

_redis_client: "redis.Redis | None" = None


def get_redis_client():
    global _redis_client
    if not REDIS_URL:
        return None
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


class RateLimiter:
    def __init__(self, max_per_minute: int):
        self.max_per_minute = max_per_minute

    async def check(self, key: str) -> None:
        client = get_redis_client()
        if client is None:
            # No Redis configured (e.g. local dev) - allow the request.
            return

        redis_key = f"ratelimit:{key}"
        try:
            count = await client.incr(redis_key)
            if count == 1:
                await client.expire(redis_key, WINDOW_SECONDS)
        except redis.RedisError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Rate limiter unavailable",
            )
            
        if count > self.max_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests",
            )


chat_rate_limiter = RateLimiter(AI_CHAT_RATE_LIMIT)


async def enforce_rate_limit(
    request: Request, user: User = Depends(get_current_user)
) -> None:
    key = user.id if user and user.id else (request.client.host if request.client else "unknown")
    await chat_rate_limiter.check(key)
