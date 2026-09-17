import pytest

from app.core.cache import clear_cache
from app.services import policy_service


@pytest.fixture(autouse=True)
def clean_cache():
    clear_cache()
    yield
    clear_cache()


SAMPLE_POLICIES = [
    {
        "id": "11111111-1111-1111-1111-111111111111",
        "title": "Remote Work Policy",
        "category": "hr",
        "content": "Employees may work remotely up to 3 days a week.",
        "is_sensitive": False,
        "updated_at": "2026-01-01T00:00:00Z",
    },
    {
        "id": "22222222-2222-2222-2222-222222222222",
        "title": "Executive Compensation Policy",
        "category": "finance",
        "content": "Executive salary bands and bonus structures.",
        "is_sensitive": True,
        "updated_at": "2026-01-01T00:00:00Z",
    },
]


@pytest.mark.asyncio
async def test_get_policies_filters_sensitive_for_unprivileged_users(monkeypatch):
    async def fake_get_active_policies(category=None):
        return SAMPLE_POLICIES

    monkeypatch.setattr(
        "app.repositories.policy_repository.get_active_policies",
        fake_get_active_policies,
    )

    visible = await policy_service.get_policies(can_view_sensitive=False)

    assert len(visible) == 1
    assert visible[0]["title"] == "Remote Work Policy"


@pytest.mark.asyncio
async def test_get_policies_includes_sensitive_for_privileged_users(monkeypatch):
    async def fake_get_active_policies(category=None):
        return SAMPLE_POLICIES

    monkeypatch.setattr(
        "app.repositories.policy_repository.get_active_policies",
        fake_get_active_policies,
    )

    visible = await policy_service.get_policies(can_view_sensitive=True)

    assert len(visible) == 2


@pytest.mark.asyncio
async def test_get_policies_uses_cache_between_calls(monkeypatch):
    calls = {"count": 0}

    async def fake_get_active_policies(category=None):
        calls["count"] += 1
        return SAMPLE_POLICIES

    monkeypatch.setattr(
        "app.repositories.policy_repository.get_active_policies",
        fake_get_active_policies,
    )

    await policy_service.get_policies(can_view_sensitive=True)
    await policy_service.get_policies(can_view_sensitive=True)

    assert calls["count"] == 1


@pytest.mark.asyncio
async def test_upsert_policy_invalidates_cache(monkeypatch):
    calls = {"count": 0}

    async def fake_get_active_policies(category=None):
        calls["count"] += 1
        return SAMPLE_POLICIES

    async def fake_upsert_policy(**kwargs):
        return SAMPLE_POLICIES[0]

    monkeypatch.setattr(
        "app.repositories.policy_repository.get_active_policies",
        fake_get_active_policies,
    )
    monkeypatch.setattr(
        "app.repositories.policy_repository.upsert_policy",
        fake_upsert_policy,
    )

    # Warm the cache.
    await policy_service.get_policies(can_view_sensitive=True)
    assert calls["count"] == 1

    await policy_service.upsert_policy(
        policy_id=None,
        title="Remote Work Policy",
        category="hr",
        content="Updated content",
        is_sensitive=False,
        updated_by="admin-1",
    )

    # Cache for the "all policies" listing must have been invalidated.
    await policy_service.get_policies(can_view_sensitive=True)
    assert calls["count"] == 2


@pytest.mark.asyncio
async def test_answer_policy_question_grounds_answer_in_relevant_policy(monkeypatch):
    async def fake_get_active_policies(category=None):
        return SAMPLE_POLICIES

    captured_messages = {}

    async def fake_generate_chat_with_cache_status(messages, **kwargs):
        captured_messages["messages"] = messages
        return "You can work remotely up to 3 days a week.", "gemini", False

    audit_calls = []

    async def fake_log_policy_interaction(**kwargs):
        audit_calls.append(kwargs)

    monkeypatch.setattr(
        "app.repositories.policy_repository.get_active_policies",
        fake_get_active_policies,
    )
    monkeypatch.setattr(
        "app.providers.orchestrator.ai_orchestrator.generate_chat_with_cache_status",
        fake_generate_chat_with_cache_status,
    )
    monkeypatch.setattr(
        "app.repositories.policy_repository.log_policy_interaction",
        fake_log_policy_interaction,
    )

    result = await policy_service.answer_policy_question(
        user_id="user-1",
        question="How many days can I work remotely?",
        can_view_sensitive=False,
    )

    assert "remotely" in result["answer"]
    assert result["policy_ids"] == ["11111111-1111-1111-1111-111111111111"]

    # The sensitive executive-comp policy must never reach the prompt context.
    system_message = captured_messages["messages"][0]["content"]
    assert "Executive Compensation" not in system_message

    assert len(audit_calls) == 1
    assert audit_calls[0]["user_id"] == "user-1"
    assert audit_calls[0]["policy_ids"] == ["11111111-1111-1111-1111-111111111111"]


@pytest.mark.asyncio
async def test_answer_policy_question_excludes_sensitive_policy_for_unprivileged_user(
    monkeypatch,
):
    async def fake_get_active_policies(category=None):
        return SAMPLE_POLICIES

    captured_messages = {}

    async def fake_generate_chat_with_cache_status(messages, **kwargs):
        captured_messages["messages"] = messages
        return "No relevant policy found.", "gemini", False

    async def fake_log_policy_interaction(**kwargs):
        pass

    monkeypatch.setattr(
        "app.repositories.policy_repository.get_active_policies",
        fake_get_active_policies,
    )
    monkeypatch.setattr(
        "app.providers.orchestrator.ai_orchestrator.generate_chat_with_cache_status",
        fake_generate_chat_with_cache_status,
    )
    monkeypatch.setattr(
        "app.repositories.policy_repository.log_policy_interaction",
        fake_log_policy_interaction,
    )

    result = await policy_service.answer_policy_question(
        user_id="user-1",
        question="What is the executive compensation bonus structure?",
        can_view_sensitive=False,
    )

    assert result["policy_ids"] == []
    system_message = captured_messages["messages"][0]["content"]
    assert "salary bands" not in system_message
