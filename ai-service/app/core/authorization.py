from typing import Iterable


ROLE_PERMISSIONS = {
    "AI_CHAT": {"ADMIN", "SENIOR_TL", "TL"},
    "AI_HEALTH": {"ADMIN"},
    "AI_USAGE": {"ADMIN"},
}


def has_permission(user_roles: Iterable[str], permission: str) -> bool:
    allowed_roles = ROLE_PERMISSIONS.get(permission)

    if allowed_roles is None:
        return False

    return bool(set(user_roles) & allowed_roles)