"""
AI routes — Python/FastAPI port of ai_routes.js

Split to match ai-service/app's layout (api/ + core/ + models/ + providers/):
  - app/models/ai.py         -> request/response schemas
  - app/core/auth.py          -> get_current_user (STUB)
  - app/core/rbac.py          -> require_roles (STUB)
  - app/core/rate_limit.py    -> enforce_rate_limit (STUB)
  - app/core/usage.py         -> daily usage tracking (STUB)
  - app/providers/*           -> base/gemini/openai adapters
  - app/providers/registry.py -> provider selection (get_provider)
"""

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.auth import User, get_current_user
from app.core.rate_limit import enforce_rate_limit
from app.core.rbac import require_roles
from app.core.security import sanitize_prompt
from app.core.usage import (
    DAILY_AI_LIMIT,
    get_daily_usage_report,
    get_today_usage,
    increment_usage,
)
from app.models.ai import (
    ChatBody,
    ChatResponse,
    HealthResponse,
    ProviderHealthEntry,
    ProviderResult,
    UsageResponse,
    GenerationRequest,
)
from app.core.cache import cache_key, get_or_set
from app.providers import ai_orchestrator
from app.providers.base import AIProviderError, ProviderAPIError, ProviderRateLimitError
from app.providers.registry import get_configured_providers_health, get_provider

router = APIRouter(prefix="/ai", tags=["AI"])

MAX_MESSAGES = 32
MAX_MESSAGE_CHARS = 4000
MAX_TOTAL_CHARS = 32000


async def call_provider(user_id: str, messages: List[dict]) -> ProviderResult:
    provider = get_provider()
    primary_provider = provider.provider_name
    model = provider.model_name
    key = cache_key(primary_provider, model, messages, 0.7)

    async def _compute():
        content, used_provider = await ai_orchestrator.generate_chat_with_fallback(
            messages
        )
        return {"content": content, "provider": used_provider}

    res_dict, cached = await get_or_set(key, _compute)

    return ProviderResult(
        provider=res_dict["provider"],
        cached=cached,
        content=res_dict["content"],
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
    # Sanitize prompt or messages
    try:
        if body.prompt:
            body.prompt = sanitize_prompt(body.prompt)
        if body.messages:
            for msg in body.messages:
                if msg.content:
                    msg.content = sanitize_prompt(msg.content)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    
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

    total_chars = sum(len(msg["content"] or "") for msg in final_messages)
    if total_chars > MAX_TOTAL_CHARS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Prompt too long",
        )

    if any(not msg["content"].strip() for msg in final_messages):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty",
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
    except ProviderRateLimitError:
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
# POST /ai/generate
# ---------------------------------------------------------------------------
@router.post(
    "/generate",
    summary="Generate text with sanitized prompt",
    response_model=ProviderResult,
)
async def generate_text(request: GenerationRequest):
    provider = get_provider()
    content = await provider.generate_text(request.prompt)
    return ProviderResult(
        provider=provider.provider_name,
        cached=False,
        content=content,
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
    from app.providers.orchestrator import get_circuit_breaker

    raw_providers = get_provider_health()
    providers = []
    for p in raw_providers:
        name = p["name"]
        cb = get_circuit_breaker(name)
        is_open = await cb.is_open()

        status_str = "unhealthy" if is_open else p["status"]
        last_err = "Circuit breaker open" if is_open else p["lastErrorMessage"]

        providers.append(
            ProviderHealthEntry(
                name=name,
                status=status_str,
                lastErrorMessage=last_err,
            )
        )
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
