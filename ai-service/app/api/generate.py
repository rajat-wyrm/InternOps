from fastapi import Depends, HTTPException, APIRouter, status

from app.core.auth import User, get_current_user
from app.core.security import sanitize_prompt

router = APIRouter()


@router.post("/generate")
async def generate(
    body: dict,
    current_user: User = Depends(get_current_user),
):
    """
    Sanitize and validate a prompt before passing to an AI provider.

    Requires a valid JWT in the Authorization header.
    """
    try:
        clean_input = sanitize_prompt(body.get("user_input", ""))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {
        "clean_input": clean_input,
        "status": "guardrail passed",
        "user_id": current_user.id,
    }