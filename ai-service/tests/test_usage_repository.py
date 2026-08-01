"""
Tests for app/repositories/usage.py — covers issue #1499's verification
checklist:

  1. log_ai_request writes exactly one ai_usage_logs row per call.
  2. get_usage_by_provider aggregates counts correctly per user/provider.
  3. A failing DB write in log_ai_request must not raise (log-and-continue).
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.repositories.usage import (
    get_daily_usage_report,
    get_usage_by_provider,
    log_ai_request,
)


def _fake_pool(execute_side_effect=None, fetch_return=None):
    pool = AsyncMock()
    if execute_side_effect is not None:
        pool.execute.side_effect = execute_side_effect
    if fetch_return is not None:
        pool.fetch.return_value = fetch_return
    return pool


# ---------------------------------------------------------------------------
# log_ai_request
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_log_ai_request_writes_one_row_with_correct_params():
    pool = _fake_pool()
    with patch("app.repositories.usage.get_pool", return_value=pool):
        await log_ai_request(
            user_id="user-123",
            provider="gemini",
            model="gemini-2.5-flash",
            prompt_tokens=10,
            completion_tokens=20,
            latency_ms=450,
            status="success",
        )

    assert pool.execute.await_count == 1
    args, _ = pool.execute.call_args
    sql, *params = args
    assert "INSERT INTO ai_usage_logs" in sql
    assert params == [
        "user-123", "gemini", "gemini-2.5-flash",
        10, 20, 450, "success",
    ]


@pytest.mark.asyncio
async def test_log_ai_request_records_failure_status():
    pool = _fake_pool()
    with patch("app.repositories.usage.get_pool", return_value=pool):
        await log_ai_request(
            user_id="user-123",
            provider="openai",
            model="gpt-4o-mini",
            prompt_tokens=0,
            completion_tokens=0,
            latency_ms=1200,
            status="failure",
        )

    _, *params = pool.execute.call_args.args
    assert params[-1] == "failure"


@pytest.mark.asyncio
async def test_log_ai_request_never_raises_when_db_write_fails():
    """Checklist item #3: a broken usage-log write must not break the caller."""
    pool = _fake_pool(execute_side_effect=RuntimeError("connection lost"))
    with patch("app.repositories.usage.get_pool", return_value=pool):
        # Should not raise, despite pool.execute raising internally.
        await log_ai_request(
            user_id="user-123",
            provider="gemini",
            model="gemini-2.5-flash",
            prompt_tokens=0,
            completion_tokens=0,
            latency_ms=5,
            status="failure",
        )

    assert pool.execute.await_count == 1


@pytest.mark.asyncio
async def test_log_ai_request_never_raises_when_get_pool_fails():
    """Covers the case where the pool itself isn't available (e.g. DB down)."""
    with patch(
        "app.repositories.usage.get_pool",
        side_effect=RuntimeError("pool not initialized"),
    ):
        await log_ai_request(
            user_id="user-123",
            provider="gemini",
            model="gemini-2.5-flash",
            prompt_tokens=0,
            completion_tokens=0,
            latency_ms=5,
            status="failure",
        )


# ---------------------------------------------------------------------------
# get_usage_by_provider
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_get_usage_by_provider_returns_aggregated_rows():
    fake_rows = [
        {
            "user_id": "user-1",
            "provider": "gemini",
            "total_requests": 5,
            "successful_requests": 4,
            "failed_requests": 1,
            "total_prompt_tokens": 0,
            "total_completion_tokens": 0,
            "avg_latency_ms": 300.0,
        }
    ]
    pool = _fake_pool(fetch_return=fake_rows)
    with patch("app.repositories.usage.get_pool", return_value=pool):
        result = await get_usage_by_provider(start_date="2026-07-01", end_date="2026-07-31")

    assert result == fake_rows
    args, _ = pool.fetch.call_args
    sql, start_date, end_date = args
    assert "GROUP BY user_id, provider" in sql
    assert start_date == "2026-07-01"
    assert end_date == "2026-07-31"


@pytest.mark.asyncio
async def test_get_usage_by_provider_accepts_no_date_range():
    pool = _fake_pool(fetch_return=[])
    with patch("app.repositories.usage.get_pool", return_value=pool):
        result = await get_usage_by_provider()

    assert result == []
    args, _ = pool.fetch.call_args
    _, start_date, end_date = args
    assert start_date is None
    assert end_date is None


# ---------------------------------------------------------------------------
# get_daily_usage_report
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_get_daily_usage_report_returns_rows_shaped_for_reporting():
    fake_rows = [
        {
            "id": "user-1",
            "email": "a@example.com",
            "full_name": "A One",
            "role": "student",
            "successful_requests": 3,
        }
    ]
    pool = _fake_pool(fetch_return=fake_rows)
    with patch("app.repositories.usage.get_pool", return_value=pool):
        result = await get_daily_usage_report()

    assert result == fake_rows
    args, _ = pool.fetch.call_args
    sql = args[0]
    assert "CURRENT_DATE" in sql
    assert "LEFT JOIN ai_usage_logs" in sql
