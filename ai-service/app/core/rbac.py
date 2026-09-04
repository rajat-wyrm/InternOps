from fastapi import Depends, HTTPException, status

from .auth import User, get_current_user
from .authorization import has_permission


def require_permission(permission: str):
    async def _check(
        user: User = Depends(get_current_user),
    ) -> User:

        if not has_permission(user.roles, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden",
            )

        return user

    return _check