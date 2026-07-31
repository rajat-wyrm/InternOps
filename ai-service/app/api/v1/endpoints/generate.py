from fastapi import APIRouter, Depends

from app.core.auth import User, get_current_user
from app.core.rate_limiter import ai_rate_limiter

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
    AI generation endpoint.

    Requires a valid JWT in the Authorization header.
    Rate-limited per verified user id (not a spoofable header).
    """
    return {
        "message": "AI request accepted.",
        "payload": payload,
        "user_id": current_user.id,
    }