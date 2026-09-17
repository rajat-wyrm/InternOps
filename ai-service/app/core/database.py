import asyncio
import asyncpg

from .config import settings

_pool = None
_lock = asyncio.Lock()


async def get_pool():
    global _pool

    if _pool is None:
        async with _lock:
            if _pool is None:
                if not settings.DATABASE_URL:
                    raise ValueError("DATABASE_URL is not configured")

                try:
                    _pool = await asyncpg.create_pool(
                        dsn=settings.DATABASE_URL,
                        min_size=1,
                        max_size=10,
                    )
                except Exception as e:
                    raise RuntimeError(
                        f"Failed to create database pool: {e}"
                    ) from e

    return _pool


async def close_pool():
    global _pool

    if _pool is not None:
        try:
            await _pool.close()
        finally:
            _pool = None