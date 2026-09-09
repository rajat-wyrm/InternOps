import redis.asyncio as redis
from fastapi import Depends, HTTPException, Request, status

from app.core.auth import User, get_current_user
from app.core.config import RATE_LIMIT_PER_MINUTE
from app.core.redis_client import get_redis


class RateLimiter:
    def __init__(self, requests_per_minute: int = RATE_LIMIT_PER_MINUTE):
        self.requests_per_minute = requests_per_minute

    async def check_rate_limit(
        self,
        request: Request,
        current_user: User = Depends(get_current_user),
    ):
        client_id = (
            current_user.id
            if isinstance(current_user, User)
            else (
                request.client.host
                if request and getattr(request, "client", None)
                else "unknown"
            )
        )

        redis_client = get_redis()
        if redis_client is None:
            # Fail closed if Redis is entirely unconfigured/unavailable
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Rate limiter unavailable",
            )

        key = f"ai:ratelimit:{client_id}"

        try:
            count = await redis_client.incr(key)

            if count == 1:
                await redis_client.expire(key, 60)

            if count > self.requests_per_minute:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="AI request rate limit exceeded. Please wait before retrying.",
                    headers={"Retry-After": "60"},
                )

        except HTTPException:
            raise
        except redis.RedisError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Rate limiter unavailable",
            )


ai_rate_limiter = RateLimiter()
# Backward-compatible alias so chat and other AI operations share the same limiter instance
chat_rate_limiter = ai_rate_limiter