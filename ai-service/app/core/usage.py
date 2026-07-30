"""
Daily AI usage tracking — STUB.

TODO(usage): back with a real store (DB/Redis). Currently in-memory and
resets on restart.
"""

import os
from collections import defaultdict
from datetime import datetime, timezone

DAILY_AI_LIMIT = int(os.getenv("AI_DAILY_LIMIT", "50"))  # TODO(config): pull from real settings

_usage_by_user_day: dict = defaultdict(int)


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


async def get_today_usage(user_id: str) -> int:
    return _usage_by_user_day[(user_id, _today())]


async def increment_usage(user_id: str) -> None:
    _usage_by_user_day[(user_id, _today())] += 1


async def get_daily_usage_report() -> list:
    today = _today()
    return [
        {"userId": uid, "count": count}
        for (uid, day), count in _usage_by_user_day.items()
        if day == today
    ]
