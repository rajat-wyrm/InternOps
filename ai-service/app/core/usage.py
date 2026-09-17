"""
Daily AI usage tracking.

Delegates all usage-tracking operations to app.repositories.ai_repository.
Usage is persisted in the `ai_usage` PostgreSQL table, keyed by
(user_id, usage_date), and survives application restarts.

"""

import os
from app.repositories.ai_repository import (
    get_today_usage as repo_get_today_usage,
    increment_usage as repo_increment_usage,
    get_daily_usage_report as repo_get_daily_usage_report,
)

DAILY_AI_LIMIT = int(os.getenv("AI_DAILY_LIMIT", "50"))  # TODO(config): pull from real settings

async def get_today_usage(user_id: str) -> int:
    return await repo_get_today_usage(user_id)


async def increment_usage(user_id: str) -> None:
    await repo_increment_usage(user_id)


async def get_daily_usage_report() -> list:
    return await repo_get_daily_usage_report()
