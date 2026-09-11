import hashlib
import json
import time
from typing import Any, Awaitable, Callable, Dict, Tuple

from app.core.config import settings
from app.core.redis_client import get_redis

# In-memory TTL cache storage: key -> (value, expire_at_timestamp)
_memory_cache: Dict[str, Tuple[Any, float]] = {}


def cache_key(
    provider: str,
    model: str,
    prompt: Any,
    temperature: float = 0.7,
    **kwargs: Any,
) -> str:
    """
    Generate a deterministic SHA-256 cache key for an AI request.
    Normalizes provider, model, prompt, temperature, and any additional parameters.
    """
    norm_provider = (provider or "").strip().lower()
    norm_model = (model or "").strip().lower()
    norm_temp = float(temperature)

    serializable_kwargs = {}
    if kwargs:
        for k, v in sorted(kwargs.items()):
            try:
                json.dumps(v)
                serializable_kwargs[k] = v
            except (TypeError, OverflowError):
                serializable_kwargs[k] = str(v)

    raw_payload = {
        "provider": norm_provider,
        "model": norm_model,
        "prompt": prompt,
        "temperature": norm_temp,
    }
    if serializable_kwargs:
        raw_payload["kwargs"] = serializable_kwargs

    raw = json.dumps(raw_payload, sort_keys=True, default=str)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"ai:cache:{digest}"


def clear_cache() -> None:
    """Clear all entries in the in-memory cache."""
    _memory_cache.clear()


def _cleanup_expired() -> None:
    """Remove expired items from in-memory cache."""
    now = time.time()
    expired_keys = [k for k, (_, exp) in _memory_cache.items() if now >= exp]
    for k in expired_keys:
        _memory_cache.pop(k, None)


async def get_cached(key: str) -> Any | None:
    """
    Retrieve a cached value from the in-memory TTL cache or Redis.

    Returns:
        Cached object if present and not expired, otherwise None.
    """
    now = time.time()
    if key in _memory_cache:
        value, exp = _memory_cache[key]
        if now < exp:
            return value
        else:
            _memory_cache.pop(key, None)

    redis = get_redis()
    if redis is not None:
        try:
            cached = await redis.get(key)
            if cached is not None:
                parsed = json.loads(cached)
                ttl = getattr(settings, "AI_CACHE_TTL", 3600) or 3600
                _memory_cache[key] = (parsed, now + ttl)
                return parsed
        except Exception:
            pass

    return None


async def set_cached(key: str, value: Any, ttl: int | None = None) -> None:
    """
    Store a value in the in-memory cache (and Redis if available) with configured TTL.
    """
    if value is None:
        return

    ttl_seconds = ttl if ttl is not None else (getattr(settings, "AI_CACHE_TTL", 3600) or 3600)
    expire_at = time.time() + ttl_seconds

    if len(_memory_cache) > 500:
        _cleanup_expired()

    _memory_cache[key] = (value, expire_at)

    redis = get_redis()
    if redis is not None:
        try:
            await redis.set(
                key,
                json.dumps(value),
                ex=ttl_seconds,
            )
        except Exception:
            pass


async def get_or_set(
    key: str,
    compute: Callable[[], Awaitable[Any]],
    ttl: int | None = None,
) -> tuple[Any, bool]:
    """
    Get a cached value if available; otherwise compute, cache, and return it.

    Returns:
        (value, cached)

        cached=True  -> Returned from cache
        cached=False -> Computed from AI provider
    """
    cached_value = await get_cached(key)

    if cached_value is not None:
        return cached_value, True

    result = await compute()

    if result is not None:
        await set_cached(key, result, ttl=ttl)

    return result, False