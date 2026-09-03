from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator
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
    prompt: Optional[str] = Field(default=None, max_length=2000)
    messages: Optional[List[ChatMessage]] = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return sanitize_user_input(v)

    @field_validator("messages")
    @classmethod
    def validate_messages(
        cls, v: Optional[List[ChatMessage]]
    ) -> Optional[List[ChatMessage]]:
        if v is None:
            return v
        for msg in v:
            msg.content = sanitize_user_input(msg.content)
        return v

    @model_validator(mode="after")
    def validate_prompt_or_messages(self) -> "GenerationRequest":
        if not self.prompt and not self.messages:
            raise ValueError("Prompt or valid messages are required")
        return self

class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., max_length=2000)

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, v: str) -> str:
        return sanitize_user_input(v)


class ImageGenerationResponse(BaseModel):
    provider: str
    image_base64: str