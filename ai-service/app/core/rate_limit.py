"""
Rate limiting — STUB.

TODO(rate-limit): replace with slowapi (or similar) once it's added as a
dependency. This is an in-memory fixed-window limiter, keyed like the JS
keyGenerator (user id if authed, else client IP) — good enough for local
testing, but resets on restart and won't work across multiple workers.
"""

import os
import time
from collections import defaultdict

from fastapi import Depends, HTTPException, Request, status

from .auth import User, get_current_user

AI_CHAT_RATE_LIMIT = int(os.getenv("AI_CHAT_RATE_LIMIT_PER_MIN", "10"))


class RateLimiter:
    def __init__(self, max_per_minute: int):
        self.max_per_minute = max_per_minute
        self._hits: dict = defaultdict(list)  # key -> [timestamps]

    def check(self, key: str) -> None:
        now = time.time()
        window_start = now - 60
        hits = [t for t in self._hits[key] if t > window_start]
        if len(hits) >= self.max_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests",
            )
        hits.append(now)
        self._hits[key] = hits


chat_rate_limiter = RateLimiter(AI_CHAT_RATE_LIMIT)


async def enforce_rate_limit(
    request: Request, user: User = Depends(get_current_user)
) -> None:
    key = user.id if user and user.id else (request.client.host if request.client else "unknown")
    chat_rate_limiter.check(key)
