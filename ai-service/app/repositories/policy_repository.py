import logging
from typing import Any, Dict, List, Optional

import asyncpg

from app.core.database import get_pool

logger = logging.getLogger(__name__)


def _row_to_dict(row: asyncpg.Record) -> Dict[str, Any]:
    return {
        "id": str(row["id"]),
        "title": row["title"],
        "category": row["category"],
        "content": row["content"],
        "is_sensitive": row["is_sensitive"],
        "updated_at": row["updated_at"],
    }


async def get_active_policies(category: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetch every active policy, optionally filtered by category.

    Returns an empty list (rather than raising) if the database is
    unavailable, so callers degrade gracefully instead of 500ing.
    """
    try:
        pool = await get_pool()

        async with pool.acquire() as conn:
            if category:
                rows = await conn.fetch(
                    """
                    SELECT id, title, category, content, is_sensitive, updated_at
                    FROM policies
                    WHERE is_active = TRUE
                      AND category = $1
                    ORDER BY updated_at DESC
                    """,
                    category,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT id, title, category, content, is_sensitive, updated_at
                    FROM policies
                    WHERE is_active = TRUE
                    ORDER BY updated_at DESC
                    """
                )

        return [_row_to_dict(row) for row in rows]

    except (asyncpg.PostgresError, RuntimeError, OSError, ValueError) as e:
        logger.warning("Database unavailable for get_active_policies: %s", e)
        return []


async def upsert_policy(
    *,
    policy_id: Optional[str],
    title: str,
    category: str,
    content: str,
    is_sensitive: bool,
    updated_by: Optional[str],
) -> Dict[str, Any]:
    """Create a new policy, or update an existing one when policy_id is given."""
    pool = await get_pool()

    async with pool.acquire() as conn:
        if policy_id:
            row = await conn.fetchrow(
                """
                UPDATE policies
                SET title = $2,
                    category = $3,
                    content = $4,
                    is_sensitive = $5,
                    updated_by = $6,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id, title, category, content, is_sensitive, updated_at
                """,
                policy_id,
                title,
                category,
                content,
                is_sensitive,
                updated_by,
            )
            if row is None:
                raise ValueError(f"Policy {policy_id} does not exist")
        else:
            row = await conn.fetchrow(
                """
                INSERT INTO policies (title, category, content, is_sensitive, updated_by)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, title, category, content, is_sensitive, updated_at
                """,
                title,
                category,
                content,
                is_sensitive,
                updated_by,
            )

    return _row_to_dict(row)


async def log_policy_interaction(
    *,
    user_id: str,
    question: str,
    policy_ids: List[str],
    answered_from_cache: bool,
) -> None:
    """Audit-log a policy chatbot interaction. Never raises: an audit-log
    failure must not block the chatbot response.
    """
    try:
        pool = await get_pool()

        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO policy_chat_audit_log (
                    user_id, question, policy_ids, answered_from_cache
                )
                VALUES ($1, $2, $3::uuid[], $4)
                """,
                user_id,
                question,
                policy_ids,
                answered_from_cache,
            )

    except (asyncpg.PostgresError, RuntimeError, OSError, ValueError) as e:
        logger.warning("Failed to write policy chat audit log: %s", e)
