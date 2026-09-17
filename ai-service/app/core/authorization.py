from typing import Iterable


ROLE_PERMISSIONS = {
    "AI_CHAT": {"ADMIN", "SENIOR_TL", "TL"},
    "AI_GENERATION": {"ADMIN", "SENIOR_TL", "TL"},
    "AI_HEALTH": {"ADMIN"},
    "AI_USAGE": {"ADMIN"},
    "AI_CERTIFICATES": {"ADMIN"},
    "CERTIFICATE_GENERATION": {"ADMIN"},
    "AI_IMAGE_GENERATION": {"ADMIN", "SENIOR_TL", "TL"},
     "ATTENDANCE_ANOMALIES": {"ADMIN", "SENIOR_TL", "TL", "CAPTAIN"},
    "ATTENDANCE_VIEW": {"ADMIN", "SENIOR_TL", "TL", "CAPTAIN"},
    "ATTENDANCE_MANAGE": {"ADMIN", "SENIOR_TL", "TL"},
    "AI_POLICY_CHAT": {"ADMIN", "SENIOR_TL", "TL"},
    "AI_POLICY_VIEW_SENSITIVE": {"ADMIN"},
    "AI_POLICY_MANAGE": {"ADMIN"},
}


def has_permission(user_roles: Iterable[str], permission: str) -> bool:
    allowed_roles = ROLE_PERMISSIONS.get(permission)

    if allowed_roles is None:
        return False

    return bool(set(user_roles) & allowed_roles)