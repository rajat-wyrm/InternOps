from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import User, get_current_user
from app.core.rate_limiter import ai_rate_limiter
from app.providers.orchestrator import ai_orchestrator
from app.providers.base import AIProviderError, ProviderAPIError, ProviderRateLimitError
from app.core.security import sanitize_prompt
router = APIRouter()


@router.post(
    "/generate",
    dependencies=[Depends(ai_rate_limiter.check_rate_limit)],
)
async def generate_ai_content(
    payload: dict,
    current_user: User = Depends(get_current_user),
):
    """
    Generate AI content using the orchestrator with failover and circuit breaker.

    Accepts either:
      - a flat `prompt` / `user_input` string (single-turn), or
      - a structured `messages` array (same shape as /ai/chat:
        [{"role": "user"|"assistant"|"system", "content": "..."}])
        so multi-turn conversation history is preserved instead of being
        collapsed into a single prompt string.

    Requires a valid JWT in the Authorization header.
    Rate-limited per verified user id.
    """
    raw_messages = payload.get("messages")

    if raw_messages is not None:
        if not isinstance(raw_messages, list) or not raw_messages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="messages must be a non-empty list",
            )

        messages = []
        for msg in raw_messages:
            role = msg.get("role") if isinstance(msg, dict) else None
            content = msg.get("content") if isinstance(msg, dict) else None
            if role not in ("user", "assistant", "system") or not content:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Each message requires a valid role and non-empty content",
                )
            try:
                content = sanitize_prompt(content)
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
                )
            messages.append({"role": role, "content": content})
    else:
        prompt = payload.get("prompt") or payload.get("user_input")
        if not prompt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Prompt or user_input is required in payload",
            )
        try:
            prompt = sanitize_prompt(prompt)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

        messages = [{"role": "user", "content": prompt}]

    try:
        content, provider_name = await ai_orchestrator.generate_chat_with_fallback(messages)
        return {
            "status": "success",
            "provider": provider_name,
            "content": content,
            "user_id": current_user.id,
        }
    except ProviderRateLimitError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI provider rate limit exceeded",
        )
    except ProviderAPIError as error:
        if error.status_code == 413:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="AI provider response too large",
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service unavailable",
        )
    except AIProviderError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service unavailable: {str(e)}",
        )
