import logging

logger = logging.getLogger(__name__)

async def get_today_usage(user_id: str) -> int:
    if not user_id:
        raise ValueError("user_id is required")

    try:
        pool = await get_pool()

        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT successful_requests
                FROM ai_usage
                WHERE user_id = $1
                  AND usage_date = CURRENT_DATE
                """,
                user_id,
            )

        return row["successful_requests"] if row else 0

    except Exception as e:
        logger.warning("Database unavailable for get_today_usage: %s", e)
        return 0


async def increment_usage(user_id: str) -> None:
    if not user_id:
        raise ValueError("user_id is required")

    try:
        pool = await get_pool()

        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO ai_usage (
                    user_id,
                    usage_date,
                    successful_requests
                )
                VALUES (
                    $1,
                    CURRENT_DATE,
                    1
                )
                ON CONFLICT (user_id, usage_date)
                DO UPDATE
                SET
                    successful_requests = ai_usage.successful_requests + 1,
                    updated_at = NOW()
                """,
                user_id,
            )

    except Exception as e:
        logger.warning("Database unavailable for increment_usage: %s", e)


async def get_daily_usage_report() -> list:
    try:
        pool = await get_pool()

        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    u.id,
                    COALESCE(a.successful_requests, 0) AS successful_requests
                FROM users u
                LEFT JOIN ai_usage a
                    ON u.id = a.user_id
                    AND a.usage_date = CURRENT_DATE
                WHERE u.deleted_at IS NULL
                ORDER BY successful_requests DESC
                """
            )

        return [
            {
                "userId": row["id"],
                "count": row["successful_requests"],
            }
            for row in rows
        ]

    except Exception as e:
        logger.warning("Database unavailable for get_daily_usage_report: %s", e)
        return []