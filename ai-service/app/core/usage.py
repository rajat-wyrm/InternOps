"""
Daily AI usage tracking — STUB.

TODO(usage): back with a real store (DB/Redis). Currently in-memory and
resets on restart.
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
