import logging
import time
from typing import Dict, List

import redis.asyncio as redis
from fastapi import Depends, HTTPException, Request, status

from app.core.auth import User, get_current_user
from app.core.config import RATE_LIMIT_PER_MINUTE, REDIS_URL

logger = logging.getLogger(__name__)

# Initialize a global Redis client.
redis_client = redis.from_url(REDIS_URL) if REDIS_URL else None

class RateLimiter:
    """Rate limiter with Redis fixed-window and in-memory sliding-window fallback."""

    def __init__(self, requests_per_minute: int = RATE_LIMIT_PER_MINUTE):
        self.requests_per_minute = requests_per_minute
        # Local fallback if Redis is unavailable
        self.history: Dict[str, List[float]] = {}

    async def check_rate_limit(
        self,
        request: Request,
        current_user: User = Depends(get_current_user),
    ):
        client_id = current_user.id if isinstance(current_user, User) else (
            request.client.host if (request and getattr(request, "client", None)) else "unknown"
        )
        
        # 1. Try Redis first
        if redis_client:
            key = f"ai:ratelimit:{client_id}"
            try:
                count = await redis_client.incr(key)
                
                # If this is the first request in the window, set expiration
                if count == 1:
                    await redis_client.expire(key, 60)

                if count > self.requests_per_minute:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="AI request rate limit exceeded. Please wait before retrying.",
                        headers={"Retry-After": "60"},
                    )
                return  # Success, exit early without using in-memory history
                
            except HTTPException:
                raise # Re-raise the 429 block
            except Exception as e:
                # Log the failure and proceed to the in-memory fallback below
                logger.warning("Redis rate limiter failed: %s. Falling back to in-memory.", e)
        
        # 2. Fallback to in-memory limiter
        current_time = time.time()
        window_start = current_time - 60

        # Filter out timestamps older than 60 seconds
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

        # Record this request
        timestamps.append(current_time)
        self.history[client_id] = timestamps

ai_rate_limiter = RateLimiter()