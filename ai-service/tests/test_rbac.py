from app.core.authorization import has_permission


def test_admin_has_all_ai_permissions():
    assert has_permission(["ADMIN"], "AI_CHAT")
    assert has_permission(["ADMIN"], "AI_HEALTH")
    assert has_permission(["ADMIN"], "AI_USAGE")


def test_senior_tl_has_chat_permission_only():
    assert has_permission(["SENIOR_TL"], "AI_CHAT")
    assert not has_permission(["SENIOR_TL"], "AI_HEALTH")
    assert not has_permission(["SENIOR_TL"], "AI_USAGE")


def test_tl_has_chat_permission_only():
    assert has_permission(["TL"], "AI_CHAT")
    assert not has_permission(["TL"], "AI_HEALTH")
    assert not has_permission(["TL"], "AI_USAGE")

def test_user_has_no_ai_permissions():
    assert not has_permission(["USER"], "AI_CHAT")
    assert not has_permission(["USER"], "AI_HEALTH")
    assert not has_permission(["USER"], "AI_USAGE")


def test_unknown_permission_is_denied():
    assert not has_permission(["ADMIN"], "UNKNOWN_PERMISSION")