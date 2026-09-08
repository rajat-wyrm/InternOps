```python
"""
AI routes — Python/FastAPI port of ai_routes.js

Split to match ai-service/app's layout:
  - app/models/ai.py         -> request/response schemas
  - app/core/auth.py         -> get_current_user
  - app/core/rbac.py         -> require_permission
  - app/core/rate_limit.py   -> enforce_rate_limit
  - app/core/usage.py        -> daily usage tracking
  - app/providers/*          -> base/gemini/openai adapters
  - app/providers/registry.py -> provider selection
"""

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.auth import User, get_current_user
from app.core.cache import cache_key, get_or_set
from app.core.rate_limit import enforce_rate_limit
from app.core.rbac import require_permission
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
    GenerationRequest,
    HealthResponse,
    ProviderHealthEntry,
    ProviderResult,
    UsageResponse,
    ImageGenerationRequest,
    ImageGenerationResponse,
)

from app.providers import ai_orchestrator
from app.providers.base import (
    AIProviderError,
    ProviderAPIError,
    ProviderRateLimitError,
)
from app.providers.registry import (
    get_configured_providers_health,
    get_provider,
)


router = APIRouter(prefix="/ai", tags=["AI"])


MAX_MESSAGES = 32
MAX_MESSAGE_CHARS = 2000
MAX_TOTAL_CHARS = 32000


async def call_provider(
    user_id: str,
    messages: List[dict],
) -> ProviderResult:
    provider = get_provider()
    primary_provider = provider.provider_name
    model = provider.model_name

    key = cache_key(
        primary_provider,
        model,
        messages,
        0.7,
    )

    async def _compute():
        content, used_provider = (
            await ai_orchestrator.generate_chat_with_fallback(
                messages
            )
        )

        return {
            "content": content,
            "provider": used_provider,
        }

    res_dict, cached = await get_or_set(
        key,
        _compute,
    )

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
    dependencies=[
        Depends(require_permission("AI_CHAT"))
    ],
)
async def chat(
    request: Request,
    body: ChatBody,
    current_user: User = Depends(get_current_user),
    _rate_limited: None = Depends(enforce_rate_limit),
):
    # -----------------------------------------------------------------------
    # Sanitize prompt/messages
    # -----------------------------------------------------------------------
    try:
        if body.prompt:
            body.prompt = sanitize_prompt(body.prompt)

        if body.messages:
            for msg in body.messages:
                if msg.content:
                    msg.content = sanitize_prompt(msg.content)

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )

    # -----------------------------------------------------------------------
    # Validate message count
    # -----------------------------------------------------------------------
    if body.messages and len(body.messages) > MAX_MESSAGES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Too many messages",
        )

    # -----------------------------------------------------------------------
    # Build final messages
    # -----------------------------------------------------------------------
    final_messages: List[dict] = []

    if body.messages:
        final_messages = [
            {
                "role": msg.role.value,
                "content": (msg.content or "")[:MAX_MESSAGE_CHARS],
            }
            for msg in body.messages
        ]

    # If no messages are supplied, use the prompt
    if not final_messages and body.prompt:
        final_messages = [
            {
                "role": "user",
                "content": body.prompt[:MAX_MESSAGE_CHARS],
            }
        ]

    # -----------------------------------------------------------------------
    # Validate prompt/messages
    # -----------------------------------------------------------------------
    if not final_messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt or valid messages are required",
        )

    # -----------------------------------------------------------------------
    # Validate total characters
    # -----------------------------------------------------------------------
    total_chars = sum(
        len(msg["content"] or "")
        for msg in final_messages
    )

    if total_chars > MAX_TOTAL_CHARS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Prompt too long",
        )

    # -----------------------------------------------------------------------
    # Validate empty messages
    # -----------------------------------------------------------------------
    if any(
        not msg["content"].strip()
        for msg in final_messages
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty",
        )

    # -----------------------------------------------------------------------
    # Check daily usage
    # -----------------------------------------------------------------------
    usage = await get_today_usage(current_user.id)

    if usage >= DAILY_AI_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily AI usage limit exceeded",
        )

    # -----------------------------------------------------------------------
    # Call AI provider
    # -----------------------------------------------------------------------
    try:
        result = await call_provider(
            current_user.id,
            final_messages,
        )

        await increment_usage(current_user.id)

        return ChatResponse(
            provider=result.provider,
            cached=result.cached,
            content=result.content,
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
            detail="AI provider service unavailable",
        )

    except AIProviderError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service unavailable",
        )


# ---------------------------------------------------------------------------
# POST /ai/generate
# ---------------------------------------------------------------------------
@router.post(
    "/generate",
    summary="Generate text from a prompt or a structured conversation history",
    response_model=ProviderResult,
    dependencies=[
        Depends(require_permission("AI_GENERATION"))
    ],
)
async def generate_text(
    request: GenerationRequest,
    current_user: User = Depends(get_current_user),
    _rate_limited: None = Depends(enforce_rate_limit),
):
    # -----------------------------------------------------------------------
    # Sanitize input
    # -----------------------------------------------------------------------
    try:
        if request.prompt:
            request.prompt = sanitize_prompt(request.prompt)

        if request.messages:
            for message in request.messages:
                if message.content:
                    message.content = sanitize_prompt(
                        message.content
                    )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )

    # -----------------------------------------------------------------------
    # Generate from conversation history
    # -----------------------------------------------------------------------
    if request.messages:
        if len(request.messages) > MAX_MESSAGES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Too many messages",
            )

        conversation = [
            {
                "role": msg.role.value,
                "content": (msg.content or "")[:MAX_MESSAGE_CHARS],
            }
            for msg in request.messages
        ]

        total_chars = sum(
            len(msg["content"] or "")
            for msg in conversation
        )

        if total_chars > MAX_TOTAL_CHARS:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Prompt too long",
            )

        if any(
            not msg["content"].strip()
            for msg in conversation
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message content cannot be empty",
            )

        content, provider_name = (
            await ai_orchestrator.generate_chat_with_fallback(
                conversation,
                temperature=request.temperature,
            )
        )

    # -----------------------------------------------------------------------
    # Generate from simple prompt
    # -----------------------------------------------------------------------
    else:
        if not request.prompt or not request.prompt.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Prompt or valid messages are required",
            )

        prompt = request.prompt[:MAX_TOTAL_CHARS]

        content, provider_name = (
            await ai_orchestrator.generate_text_with_fallback(
                prompt,
                temperature=request.temperature,
            )
        )

    return ProviderResult(
        provider=provider_name,
        cached=False,
        content=content,
    )


# ---------------------------------------------------------------------------
# POST /ai/generate-image
# ---------------------------------------------------------------------------
@router.post(
    "/generate-image",
    summary="Generate an image from an assignment topic description",
    response_model=ImageGenerationResponse,
    dependencies=[
        Depends(require_permission("AI_IMAGE_GENERATION"))
    ],
)
async def generate_image(
    body: ImageGenerationRequest,
    current_user: User = Depends(get_current_user),
    _rate_limited: None = Depends(enforce_rate_limit),
):
    # -----------------------------------------------------------------------
    # Check daily usage
    # -----------------------------------------------------------------------
    usage = await get_today_usage(current_user.id)

    if usage >= DAILY_AI_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily AI usage limit exceeded",
        )

    # -----------------------------------------------------------------------
    # Generate image
    # -----------------------------------------------------------------------
    try:
        image_base64, used_provider = (
            await ai_orchestrator.generate_image_with_fallback(
                body.prompt
            )
        )

        await increment_usage(current_user.id)

        return ImageGenerationResponse(
            provider=used_provider,
            image_base64=image_base64,
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
            detail="AI provider service unavailable",
        )

    except AIProviderError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image generation service unavailable",
        )


# ---------------------------------------------------------------------------
# GET /ai/health
# ---------------------------------------------------------------------------
@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Check AI provider health",
    dependencies=[
        Depends(require_permission("AI_HEALTH"))
    ],
)
async def health():
    from app.providers.orchestrator import get_circuit_breaker

    raw_providers = get_provider_health()

    providers = []

    for provider in raw_providers:
        name = provider["name"]

        circuit_breaker = get_circuit_breaker(name)
        is_open = await circuit_breaker.is_open()

        status_str = (
            "unhealthy"
            if is_open
            else provider["status"]
        )

        last_error = (
            "Circuit breaker open"
            if is_open
            else provider["lastErrorMessage"]
        )

        providers.append(
            ProviderHealthEntry(
                name=name,
                status=status_str,
                lastErrorMessage=last_error,
            )
        )

    return HealthResponse(
        providers=providers
    )


# ---------------------------------------------------------------------------
# GET /ai/usage
# ---------------------------------------------------------------------------
@router.get(
    "/usage",
    response_model=UsageResponse,
    summary="Get AI usage report",
    dependencies=[
        Depends(require_permission("AI_USAGE"))
    ],
)
async def usage():
    report = await get_daily_usage_report()

    return UsageResponse(
        date=datetime.now(timezone.utc)
        .date()
        .isoformat(),
        users=report,
    )
```