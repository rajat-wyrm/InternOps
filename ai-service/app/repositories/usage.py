import logging
from typing import Optional

from app.core.db import get_pool

logger = logging.getLogger(__name__)


async def log_ai_request(
    *,
    user_id: str,
    provider: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    latency_ms: int,
    status: str,
) -> None:
    """
    Records one AI provider call attempt, success or failure.
    Never raises - a logging failure must not break the caller''s response.
    """
    try:
        pool = get_pool()
        await pool.execute(
            """
            INSERT INTO ai_usage_logs (
                user_id, provider, model,
                prompt_tokens, completion_tokens,
                latency_ms, status, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, now())
            """,
            user_id, provider, model,
            prompt_tokens, completion_tokens,
            latency_ms, status,
        )
    except Exception:
        logger.exception(
            "Failed to log AI usage (user_id=%s, provider=%s, model=%s)",
            user_id, provider, model,
        )


async def get_usage_by_provider(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> list[dict]:
    """
    Request counts, token totals, and avg latency grouped by user and provider,
    optionally bounded by a date range (YYYY-MM-DD strings, inclusive).
    """
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT
            user_id,
            provider,
            COUNT(*) AS total_requests,
            COUNT(*) FILTER (WHERE status = 'success') AS successful_requests,
            COUNT(*) FILTER (WHERE status != 'success') AS failed_requests,
            SUM(prompt_tokens) AS total_prompt_tokens,
            SUM(completion_tokens) AS total_completion_tokens,
            AVG(latency_ms) AS avg_latency_ms
        FROM ai_usage_logs
        WHERE ($1::date IS NULL OR created_at >= $1)
          AND ($2::date IS NULL OR created_at < $2::date + INTERVAL '1 day')
        GROUP BY user_id, provider
        ORDER BY total_requests DESC
        """,
        start_date, end_date,
    )
    return [dict(row) for row in rows]


async def get_daily_usage_report() -> list[dict]:
    """
    Per-user successful-request count for today, joined against users -
    same shape as ai_repository.js's getDailyUsageReport.
    """
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT
            u.id,
            u.email,
            u.full_name,
            u.role,
            COALESCE(
                COUNT(a.id) FILTER (WHERE a.status = 'success'), 0
            ) AS successful_requests
        FROM users u
        LEFT JOIN ai_usage_logs a
            ON u.id = a.user_id
            AND a.created_at::date = CURRENT_DATE
        WHERE u.deleted_at IS NULL
        GROUP BY u.id, u.email, u.full_name, u.role
        ORDER BY successful_requests DESC
        """
    )
    return [dict(row) for row in rows]
