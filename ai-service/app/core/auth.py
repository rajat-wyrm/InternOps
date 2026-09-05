"""
Auth dependency — JWT verification.

Verifies the same HS256 JWT that the Node backend issues.
The token must be passed as:  Authorization: Bearer <token>

Replaces the previous stub that trusted an un-verified x-user-id header.
"""

from typing import List, Optional

import jwt
from fastapi import Depends, Header, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings


class User(BaseModel):
    id: str
    roles: List[str] = []


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
) -> User:
    """
    Extract and verify the JWT from the Authorization header.

    Raises HTTP 401 if:
    - Authorization header is missing
    - Token is not a Bearer token
    - Token signature is invalid
    - Token has expired
    - Token payload is missing required fields
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header is required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must be 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            token.strip(),
            settings.JWT_SECRET,
            algorithms=["HS256"],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or malformed token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: Optional[str] = payload.get("sub") or payload.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing user identity (sub/id)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    roles: List[str] = payload.get("roles", [])
    if not roles and "role" in payload:
        roles = [payload["role"]]
    if isinstance(roles, str):
        roles = [roles]

    return User(id=user_id, roles=roles)
