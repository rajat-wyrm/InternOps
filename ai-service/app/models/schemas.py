from pydantic import BaseModel
from typing import List, Optional


class ChatMessage(BaseModel):
    role: str  # "user", "assistant", or "system"
    content: str


class ChatRequest(BaseModel):
    messages: Optional[List[ChatMessage]] = None
    prompt: Optional[str] = None


class ChatResponse(BaseModel):
    provider: str
    content: str
    cached: bool = False
