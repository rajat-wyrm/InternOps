"""
Tests for app/core/db.py — pool lifecycle used by the usage repository.
Covers: pool creation gated on DATABASE_URL, pool teardown, and the
"not initialized" guard that get_pool() relies on to fail loudly instead
of silently returning None to a caller like usage.py.
"""

from unittest.mock import AsyncMock, patch

import pytest

import app.core.db as db_module


@pytest.fixture(autouse=True)
def _reset_pool_state():
    """Ensure module-level _pool doesn't leak state between tests."""
    db_module._pool = None
    yield
    db_module._pool = None


# ---------------------------------------------------------------------------
# get_pool
# ---------------------------------------------------------------------------
def test_get_pool_raises_when_not_initialized():
    with pytest.raises(RuntimeError, match="DB pool not initialized"):
        db_module.get_pool()


def test_get_pool_returns_pool_once_initialized():
    fake_pool = object()
    db_module._pool = fake_pool

    assert db_module.get_pool() is fake_pool


# ---------------------------------------------------------------------------
# init_db_pool
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_init_db_pool_creates_pool_when_database_url_configured():
    fake_pool = AsyncMock()
    with patch.object(db_module.settings, "DATABASE_URL", "postgres://fake-dsn"), \
         patch.object(db_module.asyncpg, "create_pool", new=AsyncMock(return_value=fake_pool)) as create_pool:
        await db_module.init_db_pool()

    create_pool.assert_awaited_once_with(
        dsn="postgres://fake-dsn", min_size=1, max_size=10
    )
    assert db_module.get_pool() is fake_pool


@pytest.mark.asyncio
async def test_init_db_pool_skips_creation_when_no_database_url():
    with patch.object(db_module.settings, "DATABASE_URL", None), \
         patch.object(db_module.asyncpg, "create_pool", new=AsyncMock()) as create_pool:
        await db_module.init_db_pool()

    create_pool.assert_not_awaited()
    with pytest.raises(RuntimeError, match="DB pool not initialized"):
        db_module.get_pool()


# ---------------------------------------------------------------------------
# close_db_pool
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_close_db_pool_closes_and_clears_pool():
    fake_pool = AsyncMock()
    db_module._pool = fake_pool

    await db_module.close_db_pool()

    fake_pool.close.assert_awaited_once()
    with pytest.raises(RuntimeError, match="DB pool not initialized"):
        db_module.get_pool()


@pytest.mark.asyncio
async def test_close_db_pool_is_a_noop_when_never_initialized():
    # Should not raise even though _pool is None.
    await db_module.close_db_pool()
    with pytest.raises(RuntimeError, match="DB pool not initialized"):
        db_module.get_pool()
