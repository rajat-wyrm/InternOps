import time
from typing import Dict, List

from fastapi import HTTPException, Request, status

from app.core.config import RATE_LIMIT_PER_MINUTE
class RateLimiter:
    """Simple in-memory sliding window rate limiter."""

    def __init__(self, requests_per_minute: int = RATE_LIMIT_PER_MINUTE):
        self.requests_per_minute = requests_per_minute
        self.history: Dict[str, List[float]] = {}
    async def check_rate_limit(self, request: Request):
        # Identify the client (User ID header or IP address)
        client_id = request.headers.get("X-User-ID") or request.client.host

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