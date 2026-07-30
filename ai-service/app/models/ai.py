"""Pydantic schemas for the AI routes (app/api/ai_routes.py)."""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


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
