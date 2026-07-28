from fastapi import APIRouter, Depends

from app.core.rate_limiter import ai_rate_limiter
router = APIRouter()
@router.post(
    "/generate",
    dependencies=[Depends(ai_rate_limiter.check_rate_limit)],
)
async def generate_ai_content(payload: dict):
    """
    Dummy AI generation endpoint.
    Replace this logic when the actual AI service is implemented.
    """

    return {
        "message": "AI request accepted.",
        "payload": payload,
    }