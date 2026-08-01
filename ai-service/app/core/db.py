import asyncpg
from typing import Optional
from app.core.config import settings

_pool: Optional[asyncpg.Pool] = None


async def init_db_pool() -> None:
    """Call once on app startup (e.g. FastAPI lifespan)."""
    global _pool
    if settings.DATABASE_URL:
        _pool = await asyncpg.create_pool(
            dsn=settings.DATABASE_URL, min_size=1, max_size=10
        )


async def close_db_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool not initialized — call init_db_pool() on startup.")
    return _pool
