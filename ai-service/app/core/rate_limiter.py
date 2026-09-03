import time

import redis.asyncio as redis
from fastapi import Depends, HTTPException, Request, status

from app.core.auth import User, get_current_user
from app.core.config import RATE_LIMIT_PER_MINUTE, REDIS_URL

redis_client = redis.from_url(REDIS_URL) if REDIS_URL else None


class RateLimiter:
    def __init__(self, requests_per_minute: int = RATE_LIMIT_PER_MINUTE):
        self.requests_per_minute = requests_per_minute
        self._hits: dict[str, list[float]] = {}

    @property
    def history(self) -> dict[str, list[float]]:
        """Backward-compatible alias for the internal per-client hit log."""
        return self._hits

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

        # Use Redis when it is configured.
        if redis_client is not None:
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

                return

            except HTTPException:
                raise
            except redis.RedisError:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Rate limiter unavailable",
                )

        # In-memory fallback when Redis is not configured.
        now = time.monotonic()
        window_start = now - 60

        hits = self._hits.setdefault(client_id, [])
        hits[:] = [timestamp for timestamp in hits if timestamp > window_start]

        if len(hits) >= self.requests_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI request rate limit exceeded. Please wait before retrying.",
                headers={"Retry-After": "60"},
            )

        hits.append(now)


ai_rate_limiter = RateLimiter()
# Backward-compatible alias so chat and other AI operations share the same limiter instance
chat_rate_limiter = ai_rate_limiter