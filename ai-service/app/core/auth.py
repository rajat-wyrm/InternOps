"""
Auth dependency — STUB.

TODO(auth): replace with real session/JWT auth once it exists. Currently
trusts an `x-user-id` header with no verification at all.
"""

from typing import List

from fastapi import Request
from pydantic import BaseModel


class User(BaseModel):
    id: str
    roles: List[str] = ["ADMIN"]  # stub: everyone is ADMIN for now


async def get_current_user(request: Request) -> User:
    # TODO(auth): replace with real auth (JWT/session lookup)
    return User(id=request.headers.get("x-user-id", "stub-user"))
