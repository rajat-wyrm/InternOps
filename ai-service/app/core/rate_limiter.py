import time
import redis.asyncio as redis
from fastapi import Depends, HTTPException, Request, status

from app.core.auth import User, get_current_user
from app.core.redis_client import get_redis
from app.core.usage import get_today_usage


TIER_LIMITS = {
    "ADMIN": {"capacity": 100, "refill_rate": 10.0, "daily_limit": 1000},
    "SENIOR_TL": {"capacity": 50, "refill_rate": 5.0, "daily_limit": 500},
    "TL": {"capacity": 50, "refill_rate": 5.0, "daily_limit": 500},
    "CAPTAIN": {"capacity": 20, "refill_rate": 2.0, "daily_limit": 200},
    "INTERN": {"capacity": 5, "refill_rate": 0.5, "daily_limit": 50},
}

DEFAULT_TIER = {"capacity": 5, "refill_rate": 0.5, "daily_limit": 50}


class RateLimiter:
    def __init__(self):
        pass

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

        tier_config = DEFAULT_TIER
        if isinstance(current_user, User):
            for role in current_user.roles:
                role_upper = role.upper()
                if role_upper in TIER_LIMITS:
                    if TIER_LIMITS[role_upper]["capacity"] > tier_config["capacity"]:
                        tier_config = TIER_LIMITS[role_upper]

        # Check daily limit
        if isinstance(current_user, User):
            usage = await get_today_usage(client_id)
            if usage >= tier_config["daily_limit"]:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Daily AI usage limit exceeded",
                )

        redis_client = get_redis()
        if redis_client is None:
            # Fail open if Redis is entirely unconfigured/unavailable for local dev
            return

        key = f"ai:ratelimit:tb:{client_id}"
        capacity = tier_config["capacity"]
        refill_rate = tier_config["refill_rate"]
        now = time.time()

        script = """
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local requested = 1

        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1])
        local last_refill = tonumber(bucket[2])

        if not tokens then
            tokens = capacity
            last_refill = now
        end

        local elapsed = now - last_refill
        local new_tokens = math.min(capacity, tokens + elapsed * refill_rate)

        if new_tokens >= requested then
            redis.call('HMSET', key, 'tokens', new_tokens - requested, 'last_refill', now)
            redis.call('EXPIRE', key, math.ceil(capacity / refill_rate))
            return 1
        else
            return 0
        end
        """

        try:
            allowed = await redis_client.eval(script, 1, key, capacity, refill_rate, now)
            if not allowed:
                retry_after = str(int(1 / refill_rate)) if refill_rate > 0 else "60"
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="AI request rate limit exceeded. Please wait before retrying.",
                    headers={"Retry-After": retry_after},
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