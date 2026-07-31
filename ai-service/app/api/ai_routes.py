"""
AI routes — Python/FastAPI port of ai_routes.js

Split to match ai-service/app's layout (api/ + core/ + models/ + providers/):
  - app/models/ai.py         -> request/response schemas
  - app/core/auth.py          -> get_current_user (STUB)
  - app/core/rbac.py           -> require_roles (STUB)
  - app/core/rate_limit.py      -> enforce_rate_limit (STUB)
  - app/core/usage.py            -> daily usage tracking (STUB)
  - app/providers/*                -> base/gemini/openai adapters (real, from #1421)
  - app/providers/registry.py     -> provider selection (get_provider), added here

`call_provider` below flattens the message list into a single prompt
(see `_messages_to_prompt`) since BaseAIProvider.generate_text() doesn't
support multi-turn history yet, then calls the configured adapter for real.
"""

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..core.auth import User, get_current_user
from ..core.rate_limit import enforce_rate_limit
from ..core.rbac import require_roles
from ..core.usage import (
    DAILY_AI_LIMIT,
    get_daily_usage_report,
    get_today_usage,
    increment_usage,
)
from ..models.ai import (
    ChatBody,
    ChatResponse,
    HealthResponse,
    ProviderHealthEntry,
    ProviderResult,
    UsageResponse,
)
from ..providers.base import AIProviderError, ProviderAPIError, ProviderRateLimitError
from ..providers.registry import get_configured_providers_health, get_provider
from ..core.security import sanitize_prompt

router = APIRouter(prefix="/ai", tags=["AI"])

MAX_MESSAGES = 32
MAX_MESSAGE_CHARS = 4000
MAX_TOTAL_CHARS = 32000
# Fastify's bodyLimit (2MB) equivalent belongs at the ASGI/reverse-proxy
# layer (e.g. nginx client_max_body_size), not in route code.
BODY_LIMIT_BYTES = 2 * 1024 * 1024


def _messages_to_prompt(messages: List[dict]) -> str:
    """Flatten a chat-style message list into a single prompt string.

    TODO(providers): BaseAIProvider.generate_text() takes a single prompt,
    not a multi-turn message list — the adapters don't have native
    chat/history support yet. This is a simple, intentionally-lossy
    workaround (roles become text labels, no real conversation structure)
    until the provider interface grows multi-turn support.
    """
    role_labels = {"user": "User", "assistant": "Assistant", "system": "System"}
    return "\n\n".join(
        f"{role_labels.get(m['role'], m['role'])}: {m['content']}" for m in messages
    )


async def call_provider(user_id: str, messages: List[dict]) -> ProviderResult:
    provider = get_provider()
    prompt = _messages_to_prompt(messages)
    content = await provider.generate_text(prompt)
    return ProviderResult(
        provider=provider.provider_name,
        cached=False,  # TODO(caching): no caching layer wired up yet
        content=content,
    )


def get_provider_health() -> list:
    return get_configured_providers_health()


# ---------------------------------------------------------------------------
# POST /ai/chat
# ---------------------------------------------------------------------------
@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Send chat message to AI",
    dependencies=[Depends(require_roles("ADMIN", "SENIOR_TL", "TL"))],
)
async def chat(
    request: Request,
    body: ChatBody,
    current_user: User = Depends(get_current_user),
    _rate_limited: None = Depends(enforce_rate_limit),
):
    
    final_messages: List[dict] = []

    if body.messages:
        # Role validity is enforced by the Role enum on ChatMessage —
        # an invalid role fails FastAPI's own 422 validation before we
        # get here (equivalent to the JS 400 "Invalid message role").
        final_messages = [
            {"role": msg.role.value, "content": (msg.content or "")[:2000]}
            for msg in body.messages[:16]
        ]

    if not final_messages and body.prompt:
        final_messages = [{"role": "user", "content": body.prompt[:2000]}]

    if not final_messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt or valid messages are required",
        )

    if len(final_messages) > MAX_MESSAGES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Too many messages",
        )

    total_chars = 0
    for msg in final_messages:
        content = msg["content"] or ""
        if len(content) > MAX_MESSAGE_CHARS:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Message exceeds maximum length",
            )
        total_chars += len(content)

    if total_chars > MAX_TOTAL_CHARS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Prompt too long",
        )

    if any(not msg["content"] or not msg["content"].strip() for msg in final_messages):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty",
        )

    try:
        for msg in final_messages:
            msg["content"] = sanitize_prompt(msg["content"])
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    usage = await get_today_usage(current_user.id)
    if usage >= DAILY_AI_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily AI usage limit exceeded",
        )

    try:
        result = await call_provider(current_user.id, final_messages)
        await increment_usage(current_user.id)
        return ChatResponse(
            provider=result.provider, cached=result.cached, content=result.content
        )
    except ProviderRateLimitError as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI provider rate limit exceeded",
        )
    except ProviderAPIError as error:
        if error.status_code == 413:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="AI provider response too large",
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI provider service unavailable"
        )
    except AIProviderError as error:
        # Covers ProviderTimeoutError, and any AIProviderError raised
        # directly by the registry (e.g. missing API key config).
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service unavailable",
        )
        
# ---------------------------------------------------------------------------
# GET /ai/health
# ---------------------------------------------------------------------------
@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Check AI provider health",
    dependencies=[Depends(require_roles("ADMIN"))],
)
async def health():
    providers = [
        ProviderHealthEntry(
            name=p["name"],
            status="healthy" if p["available"] else "unhealthy",
            lastErrorMessage=(p.get("lastError") or {}).get("message"),
        )
        for p in get_configured_providers_health()
    ]
    return HealthResponse(providers=providers)


# ---------------------------------------------------------------------------
# GET /ai/usage
# ---------------------------------------------------------------------------
@router.get(
    "/usage",
    response_model=UsageResponse,
    summary="Get AI usage report",
    dependencies=[Depends(require_roles("ADMIN"))],
)
async def usage():
    report = await get_daily_usage_report()
    return UsageResponse(
        date=datetime.now(timezone.utc).date().isoformat(),
        users=report,
    )
