"""
Auth dependency — STUB.

TODO(auth): replace with real session/JWT auth once it exists. Currently
trusts an `x-user-id` header with no verification at all.
"""

from typing import List

from fastapi import Request
from pydantic import BaseModel


class User(BaseModel):
  {
    "id": "123",
    "roles": ["ADMIN"]
  } # stub: everyone is ADMIN for now


async def get_current_user(request: Request) -> User:
    # TODO(auth): replace with real auth (JWT/session lookup)

    raw_roles = request.headers.get("X-user-roles")

    if raw_roles is None:
        raw_roles = request.headers.get("X-user-role")

    if isinstance(raw_roles, str):
        roles = [raw_roles]
    elif raw_roles is None:
        roles = []
    else:
        roles = list(raw_roles)

    return User(
        id=request.headers.get("X-user-id", "stub-user"),
        roles=roles,
    )
