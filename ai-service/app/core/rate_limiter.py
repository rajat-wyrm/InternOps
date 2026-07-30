import time
from typing import Dict, List

from fastapi import Depends, HTTPException, Request, status

from app.core.config import RATE_LIMIT_PER_MINUTE
from app.core.auth import User, get_current_user


class RateLimiter:
    """Simple in-memory sliding window rate limiter.

    Keys off the verified user_id from the JWT (injected via get_current_user),
    NOT a client-supplied header — the previous X-User-ID approach was spoofable.
    """

    def __init__(self, requests_per_minute: int = RATE_LIMIT_PER_MINUTE):
        self.requests_per_minute = requests_per_minute
        self.history: Dict[str, List[float]] = {}

    async def check_rate_limit(
        self,
        request: Request,
        current_user: User = Depends(get_current_user),
    ):
        # Use the cryptographically verified user id from the JWT.
        # Falls back to client IP only as a last resort (should never happen
        # since get_current_user already enforces auth).
        client_id = current_user.id if current_user else (
            request.client.host if request.client else "unknown"
        )

        current_time = time.time()
        window_start = current_time - 60

        # Keep only requests made in the last 60 seconds
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

        # Record the current request
        timestamps.append(current_time)

        # Save the updated history
        self.history[client_id] = timestamps


ai_rate_limiter = RateLimiter()