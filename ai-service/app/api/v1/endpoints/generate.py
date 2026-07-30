from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.rate_limiter import ai_rate_limiter
from app.core.security import sanitize_prompt

router = APIRouter()


@router.post(
    "/generate",
    dependencies=[Depends(ai_rate_limiter.check_rate_limit)],
)
async def generate_ai_content(request: Request):
    """
    AI generation endpoint — rate limited and prompt-sanitized.
    Replace the dummy response below when the actual AI service is implemented.
    """
    try:
        data = await request.json()
        clean_input = sanitize_prompt(data.get("user_input"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "message": "AI request accepted.",
        "clean_input": clean_input,
        "status": "guardrail passed",
    }
