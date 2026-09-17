import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.repositories.ai_repository import get_today_usage, increment_usage, get_daily_usage_report

@pytest.mark.asyncio
@patch("app.repositories.ai_repository.get_pool")
async def test_get_today_usage_success(mock_get_pool):
    mock_pool = MagicMock()
    mock_conn = AsyncMock()
    
    mock_acquire_ctx = AsyncMock()
    mock_acquire_ctx.__aenter__.return_value = mock_conn
    mock_pool.acquire.return_value = mock_acquire_ctx
    
    mock_get_pool.return_value = mock_pool
    
    mock_conn.fetchrow.return_value = {"successful_requests": 5}
    
    usage = await get_today_usage("user-123")
    
    assert usage == 5
    mock_get_pool.assert_called_once()
    mock_conn.fetchrow.assert_called_once()

@pytest.mark.asyncio
@patch("app.repositories.ai_repository.get_pool")
async def test_get_today_usage_no_user(mock_get_pool):
    with pytest.raises(ValueError, match="user_id is required"):
        await get_today_usage("")
    mock_get_pool.assert_not_called()

@pytest.mark.asyncio
@patch("app.repositories.ai_repository.get_pool")
async def test_increment_usage_success(mock_get_pool):
    mock_pool = MagicMock()
    mock_conn = AsyncMock()
    
    mock_acquire_ctx = AsyncMock()
    mock_acquire_ctx.__aenter__.return_value = mock_conn
    mock_pool.acquire.return_value = mock_acquire_ctx
    
    mock_get_pool.return_value = mock_pool
    
    await increment_usage("user-123")
    
    mock_get_pool.assert_called_once()
    mock_conn.execute.assert_called_once()

@pytest.mark.asyncio
@patch("app.repositories.ai_repository.get_pool")
async def test_get_daily_usage_report_success(mock_get_pool):
    mock_pool = MagicMock()
    mock_conn = AsyncMock()
    
    mock_acquire_ctx = AsyncMock()
    mock_acquire_ctx.__aenter__.return_value = mock_conn
    mock_pool.acquire.return_value = mock_acquire_ctx
    
    mock_get_pool.return_value = mock_pool
    
    mock_conn.fetch.return_value = [
        {"id": "user-1", "successful_requests": 10},
        {"id": "user-2", "successful_requests": 5}
    ]
    
    report = await get_daily_usage_report()
    
    assert len(report) == 2
    assert report[0]["userId"] == "user-1"
    assert report[0]["count"] == 10
    
    mock_get_pool.assert_called_once()
    mock_conn.fetch.assert_called_once()

@pytest.mark.asyncio
@patch("app.repositories.ai_repository.get_pool")
async def test_db_unavailable_fallback(mock_get_pool):
    # Simulate a database failure that should be caught and fallback to 0/empty
    mock_get_pool.side_effect = RuntimeError("DB connection failed")
    
    usage = await get_today_usage("user-123")
    assert usage == 0
    
    report = await get_daily_usage_report()
    assert report == []
    
    # Ensure increment_usage doesn't raise exception
    await increment_usage("user-123")
