import logging
import time
import uuid
from typing import Dict, List, Optional

import redis.asyncio as redis
from fastapi import Depends, HTTPException, Request, status

from app.core.auth import User, get_current_user
from app.core.config import RATE_LIMIT_PER_MINUTE, REDIS_URL

logger = logging.getLogger(__name__)


class RateLimiter:
    """Simple in-memory sliding window rate limiter.

    Keys off the verified user_id from the JWT (injected via get_current_user),
    NOT a client-supplied header — the previous X-User-ID approach was spoofable.
    """

    def __init__(
        self,
        requests_per_minute: int = RATE_LIMIT_PER_MINUTE,
        redis_url: Optional[str] = REDIS_URL,
    ):
        self.requests_per_minute = requests_per_minute
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None

        # Local fallback if Redis is unavailable
        self.history: Dict[str, List[float]] = {}

    async def _get_redis(self) -> Optional[redis.Redis]:
        """Lazily initialize and validate the Redis client."""
        if self.redis_client is not None:
            return self.redis_client

        if not self.redis_url:
            return None

        try:
            client = redis.Redis.from_url(
                self.redis_url,
                decode_responses=True,
            )
            await client.ping()
            self.redis_client = client
            return client
        except redis.RedisError as exc:
            logger.warning(
                "Failed to connect to Redis. Falling back to in-memory rate limiting: %s",
                exc,
            )
        return None

    async def check_rate_limit(
        self,
        request: Request,
        current_user: User = Depends(get_current_user),
    ):
        # Use the cryptographically verified user id from the JWT.
        # Falls back to client IP only as a last resort (should never happen
        # since get_current_user already enforces auth).
        client_id = current_user.id if isinstance(current_user, User) else (
            request.client.host if (request and getattr(request, "client", None)) else "unknown"
        )

        # ------------------------------------------------------------------
        # Redis-backed distributed rate limiting
        # ------------------------------------------------------------------
        redis_conn = await self._get_redis()

        if redis_conn:
            try:
                current_time = time.time()
                window_start = current_time - 60
                key = f"ai:ratelimit:{client_id}"

                # Unique member prevents collisions for requests
                # arriving at the same timestamp
                member = f"{current_time}:{uuid.uuid4().hex}"

                async with redis_conn.pipeline(transaction=True) as pipe:
                    pipe.zremrangebyscore(key, 0, window_start)
                    pipe.zadd(key, {member: current_time})
                    pipe.zcard(key)
                    pipe.expire(key, 60)

                    results = await pipe.execute()

                request_count = results[2]

                if request_count > self.requests_per_minute:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="AI request rate limit exceeded. Please wait before retrying.",
                        headers={"Retry-After": "60"},
                    )

                return

            except redis.RedisError as exc:
                logger.warning(
                    "Redis error during rate limit check. "
                    "Falling back to in-memory limiter: %s",
                    exc,
                )

        # ------------------------------------------------------------------
        # Fallback: existing in-memory sliding window
        # ------------------------------------------------------------------
        current_time = time.time()
        window_start = current_time - 60

        timestamps = [
            ts
            for ts in self.history.get(client_id, [])
            if ts > window_start
        ]

        # If the client has already reached the limit, reject the request
        if len(timestamps) >= self.requests_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI request rate limit exceeded. Please wait before retrying.",
                headers={"Retry-After": "60"},
            )

        timestamps.append(current_time)
        self.history[client_id] = timestamps


ai_rate_limiter = RateLimiter()