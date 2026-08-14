from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from app.core.security import sanitize_user_input

class Role(str, Enum):
    user = "user"
    assistant = "assistant"
    system = "system"

class ChatMessage(BaseModel):
    role: Role
    content: str

class ChatBody(BaseModel):
    messages: Optional[List[ChatMessage]] = None
    prompt: Optional[str] = None

class ChatResponse(BaseModel):
    provider: str
    cached: bool
    content: str

class ProviderResult(BaseModel):
    provider: str
    cached: bool
    content: str

class ProviderHealthEntry(BaseModel):
    name: str
    status: str
    lastErrorMessage: Optional[str] = None

class HealthResponse(BaseModel):
    providers: List[ProviderHealthEntry]

class UsageResponse(BaseModel):
    date: str
    users: list

#  New schema for generation requests
class GenerationRequest(BaseModel):
    prompt: str = Field(..., max_length=2000)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, v: str) -> str:
        return sanitize_user_input(v)
