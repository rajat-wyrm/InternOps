from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import User, get_current_user
from app.core.rate_limiter import ai_rate_limiter
from app.providers.orchestrator import ai_orchestrator
from app.providers.base import AIProviderError, ProviderAPIError, ProviderRateLimitError
from app.core.security import sanitize_prompt

router = APIRouter()

class NoticeAssistRequest(BaseModel):
    content: str

class ExtractedInfo(BaseModel):
    deadline: Optional[str] = None
    application_link: Optional[str] = None
    eligibility: Optional[str] = None
    date_time: Optional[str] = None
    other_details: List[str] = Field(default_factory=list)

class NoticeAssistResponse(BaseModel):
    suggested_title: str
    suggested_category: str
    summary: str
    extracted_info: ExtractedInfo
    suggested_action_button: str
    rewritten_content: str

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
            #... keep the rest of your function as it was in master