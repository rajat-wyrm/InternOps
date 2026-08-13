from redis.asyncio import Redis
from app.core.config import settings

redis_client: Redis | None = None


async def connect_redis() -> None:
    global redis_client

    if not settings.REDIS_URL:
        return

    redis_client = Redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
    )

    await redis_client.ping()


async def disconnect_redis() -> None:
    """Close the Redis connection when the application shuts down."""
    global redis_client

    if redis_client is not None:
        await redis_client.aclose()
        redis_client = None


def get_redis() -> Redis | None:
    """Return the shared Redis client."""
    return redis_client
