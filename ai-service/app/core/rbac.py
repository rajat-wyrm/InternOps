"""
Role-based access control — STUB.

TODO(rbac): replace with a real role check once roles are backed by
something other than the hardcoded stub in core/auth.py.
"""

from fastapi import Depends, HTTPException, status

from .auth import User, get_current_user


def require_roles(*allowed_roles: str):
    async def _check(user: User = Depends(get_current_user)) -> User:
        # TODO(rbac): replace with real role check
        if not set(user.roles) & set(allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )
        return user

    return _check
