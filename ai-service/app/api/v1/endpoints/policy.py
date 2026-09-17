from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import User, get_current_user
from app.core.authorization import has_permission
from app.core.rbac import require_permission
from app.models.policy import (
    PolicyChatRequest,
    PolicyChatResponse,
    PolicyResponse,
    PolicyUpsertRequest,
)
from app.services import policy_service

router = APIRouter()


@router.get(
    "",
    response_model=List[PolicyResponse],
    dependencies=[Depends(require_permission("AI_POLICY_CHAT"))],
)
async def list_policies(
    category: Optional[str] = None,
    user: User = Depends(get_current_user),
):
    can_view_sensitive = has_permission(user.roles, "AI_POLICY_VIEW_SENSITIVE")
    policies = await policy_service.get_policies(
        category=category,
        can_view_sensitive=can_view_sensitive,
    )
    return policies


@router.post(
    "",
    response_model=PolicyResponse,
    dependencies=[Depends(require_permission("AI_POLICY_MANAGE"))],
)
async def upsert_policy(
    request: PolicyUpsertRequest,
    user: User = Depends(get_current_user),
):
    try:
        return await policy_service.upsert_policy(
            policy_id=request.id,
            title=request.title,
            category=request.category,
            content=request.content,
            is_sensitive=request.is_sensitive,
            updated_by=user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/chat",
    response_model=PolicyChatResponse,
    dependencies=[Depends(require_permission("AI_POLICY_CHAT"))],
)
async def chat_with_policies(
    request: PolicyChatRequest,
    user: User = Depends(get_current_user),
):
    can_view_sensitive = has_permission(user.roles, "AI_POLICY_VIEW_SENSITIVE")
    result = await policy_service.answer_policy_question(
        user_id=user.id,
        question=request.question,
        can_view_sensitive=can_view_sensitive,
    )
    return result
