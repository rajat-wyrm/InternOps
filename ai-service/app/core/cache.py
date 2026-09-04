import hashlib
import json
from typing import Any, Awaitable, Callable

from app.core.config import settings
from app.core.redis_client import get_redis


def cache_key(
    provider: str,
    model: str,
    prompt: Any,
    temperature: float,
) -> str:
    """
    Generate a deterministic cache key for an AI request.
    """

    raw = json.dumps(
        {
            "provider": provider,
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
        },
        sort_keys=True,
    )

    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()

    return f"ai:cache:{digest}"


async def get_cached(key: str) -> Any | None:
    """
    Retrieve a cached value from Redis.

    Returns:
        Cached object if present, otherwise None.
    """

    redis = get_redis()

    if redis is None:
        return None

    cached = await redis.get(key)

    if cached is None:
        return None

    try:
        return json.loads(cached)
    except json.JSONDecodeError:
        # Treat corrupted cache entries as cache misses.
        return None


async def set_cached(key: str, value: Any) -> None:
    """
    Store a value in Redis with the configured TTL.
    """

    redis = get_redis()

    if redis is None:
        return

    ttl = settings.AI_CACHE_TTL or 3600

    await redis.set(
        key,
        json.dumps(value),
        ex=ttl,
    )


async def get_or_set(
    key: str,
    compute: Callable[[], Awaitable[Any]],
) -> tuple[Any, bool]:
    """
    Get a cached value if available; otherwise compute, cache, and return it.

    Returns:
        (value, cached)

        cached=True  -> Returned from Redis
        cached=False -> Computed from AI provider
    """

    cached_value = await get_cached(key)

    if cached_value is not None:
        return cached_value, True

    result = await compute()

    if result is not None:
        await set_cached(key, result)

    return result, False