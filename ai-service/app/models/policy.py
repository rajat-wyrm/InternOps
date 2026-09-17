from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from app.core.security import sanitize_user_input


class PolicyResponse(BaseModel):
    id: str
    title: str
    category: str
    content: str
    is_sensitive: bool
    updated_at: datetime


class PolicyUpsertRequest(BaseModel):
    id: Optional[str] = None
    title: str = Field(..., max_length=255)
    category: str = Field(..., max_length=100)
    content: str = Field(..., max_length=20000)
    is_sensitive: bool = False


class PolicyChatRequest(BaseModel):
    question: str = Field(..., max_length=2000)

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        return sanitize_user_input(v)


class PolicyChatResponse(BaseModel):
    answer: str
    cached: bool
    policy_ids: List[str]
