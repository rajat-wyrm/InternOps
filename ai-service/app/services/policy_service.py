"""
Policy database integration for the AIML chatbot (issue #2062).

Connects the AI service's chatbot to the shared PostgreSQL policy
database, keeps a short-lived cache in front of it for performance, and
grounds chatbot answers in the current policy text so responses stay in
sync with the latest policies without needing a restart.
"""

import logging
import re
from typing import Any, Dict, List, Optional

from app.core.cache import delete_cached, get_or_set
from app.providers.orchestrator import ai_orchestrator
from app.repositories import policy_repository

logger = logging.getLogger(__name__)

# Acceptance criteria (#2062) calls for policy updates to be reflected
# within 5 minutes; upsert_policy() also proactively invalidates the
# relevant cache entries, so this TTL is really just a safety net.
POLICY_CACHE_TTL_SECONDS = 300

_ALL_POLICIES_KEY = "policy:list:all"


def _category_key(category: str) -> str:
    return f"policy:list:category:{category.strip().lower()}"


def _visible_to(policy: Dict[str, Any], can_view_sensitive: bool) -> bool:
    return can_view_sensitive or not policy["is_sensitive"]


async def get_policies(
    category: Optional[str] = None,
    can_view_sensitive: bool = False,
) -> List[Dict[str, Any]]:
    """Return active policies, filtering out sensitive ones for callers
    without elevated permissions. RBAC is enforced here (not just at the
    route layer) so the same guarantee applies to every caller, including
    the chatbot's own context-building step below.
    """
    cache_key = _category_key(category) if category else _ALL_POLICIES_KEY

    async def _fetch() -> List[Dict[str, Any]]:
        return await policy_repository.get_active_policies(category=category)

    policies, _cached = await get_or_set(cache_key, _fetch, ttl=POLICY_CACHE_TTL_SECONDS)
    policies = policies or []

    return [p for p in policies if _visible_to(p, can_view_sensitive)]


async def upsert_policy(
    *,
    policy_id: Optional[str],
    title: str,
    category: str,
    content: str,
    is_sensitive: bool,
    updated_by: Optional[str],
) -> Dict[str, Any]:
    """Create/update a policy and invalidate its cached listings immediately,
    so admin edits are visible right away rather than waiting on the TTL.
    """
    saved = await policy_repository.upsert_policy(
        policy_id=policy_id,
        title=title,
        category=category,
        content=content,
        is_sensitive=is_sensitive,
        updated_by=updated_by,
    )

    await delete_cached(_ALL_POLICIES_KEY)
    await delete_cached(_category_key(category))

    return saved


def _tokenize(text: str) -> set:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _find_relevant_policies(
    question: str, policies: List[Dict[str, Any]], limit: int = 3
) -> List[Dict[str, Any]]:
    """Rank cached policies by keyword overlap with the question.

    This is a lightweight, dependency-free retrieval step (no embeddings/
    vector search infra exists in this service yet) that keeps the chatbot
    grounded in real policy text rather than the model's own guesses.
    """
    question_terms = _tokenize(question)
    if not question_terms:
        return []

    scored = []
    for policy in policies:
        policy_terms = _tokenize(f"{policy['title']} {policy['content']}")
        overlap = len(question_terms & policy_terms)
        if overlap > 0:
            scored.append((overlap, policy))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [policy for _score, policy in scored[:limit]]


def _build_context_prompt(question: str, policies: List[Dict[str, Any]]) -> List[dict]:
    if policies:
        policy_text = "\n\n".join(
            f"### {p['title']} ({p['category']})\n{p['content']}" for p in policies
        )
        system_content = (
            "You are the company policy assistant. Answer the user's question "
            "using ONLY the policy excerpts below. If the excerpts don't cover "
            "the question, say the policy database has no relevant information "
            "instead of guessing.\n\n" + policy_text
        )
    else:
        system_content = (
            "You are the company policy assistant. No matching policy was "
            "found in the policy database for this question — say so instead "
            "of guessing at an answer."
        )

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": question},
    ]


async def answer_policy_question(
    *,
    user_id: str,
    question: str,
    can_view_sensitive: bool,
) -> Dict[str, Any]:
    """Answer a chatbot question from the policy database and audit-log the
    interaction (per the issue's requirement to log every policy-related
    chatbot interaction).
    """
    policies = await get_policies(can_view_sensitive=can_view_sensitive)
    relevant = _find_relevant_policies(question, policies)

    messages = _build_context_prompt(question, relevant)
    content, _provider, cached = await ai_orchestrator.generate_chat_with_cache_status(
        messages
    )

    policy_ids = [p["id"] for p in relevant]

    await policy_repository.log_policy_interaction(
        user_id=user_id,
        question=question,
        policy_ids=policy_ids,
        answered_from_cache=cached,
    )

    return {"answer": content, "cached": cached, "policy_ids": policy_ids}
