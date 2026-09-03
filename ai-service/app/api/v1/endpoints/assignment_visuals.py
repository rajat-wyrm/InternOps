from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import User, get_current_user
from app.core.rate_limiter import ai_rate_limiter
from app.providers.base import AIProviderError, ProviderAPIError, ProviderRateLimitError
from app.services.assignment_visuals import (
    DuplicateGenerationError,
    generate_assignment_visual,
)

router = APIRouter()


@router.post(
    "/assignments/generate-visual",
    dependencies=[Depends(ai_rate_limiter.check_rate_limit)],
)
async def generate_visual(
    payload: dict,
    current_user: User = Depends(get_current_user),
):
    """
    Generate an AI image for an assignment topic/description so it can be
    previewed and attached during assignment creation/editing.

    Requires a valid JWT in the Authorization header. Rate-limited per user.
    Returns 409 if a generation request for the same topic is already in
    flight for this user, and 503 (rather than a hard failure) if the
    image-generation provider is unavailable, so existing assignment
    creation flows can continue without a visual.
    """
    topic = payload.get("topic") or payload.get("description")
    if not topic or not str(topic).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="topic or description is required in payload",
        )

    try:
        result = await generate_assignment_visual(topic, user_id=current_user.id)
        return {
            "status": "success",
            "image_url": result["image_url"],
            "provider": result["provider"],
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except DuplicateGenerationError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
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
            detail="Image generation is temporarily unavailable. You can continue without a visual.",
        )
    except AIProviderError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Image generation is temporarily unavailable: {str(e)}",
        )
