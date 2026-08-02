from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import User, get_current_user
from app.core.rate_limiter import ai_rate_limiter
from app.providers.orchestrator import ai_orchestrator
from app.providers.base import AIProviderError, ProviderAPIError, ProviderRateLimitError

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

    Requires a valid JWT in the Authorization header.
    Rate-limited per verified user id.
    """
    prompt = payload.get("prompt") or payload.get("user_input")
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt or user_input is required in payload",
        )

    try:
        content, provider_name = await ai_orchestrator.generate_text_with_fallback(prompt)
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
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
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
