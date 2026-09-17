import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints.policy import router
from app.core.auth import User, get_current_user
from app.core.cache import clear_cache


@pytest.fixture(autouse=True)
def clean_cache():
    clear_cache()
    yield
    clear_cache()


@pytest.fixture
def app():
    fastapi_app = FastAPI()
    fastapi_app.include_router(router, prefix="/api/v1/policies")
    return fastapi_app


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


def _override_user(app, roles):
    app.dependency_overrides[get_current_user] = lambda: User(
        id="test-user", roles=roles
    )
    return TestClient(app, raise_server_exceptions=False)


def test_list_policies_requires_auth(client):
    r = client.get("/api/v1/policies")
    assert r.status_code == 401


def test_list_policies_requires_permission(app):
    client = _override_user(app, roles=[])
    r = client.get("/api/v1/policies")
    assert r.status_code == 403


def test_list_policies_hides_sensitive_from_tl(app, monkeypatch):
    async def fake_get_policies(category=None, can_view_sensitive=False):
        assert can_view_sensitive is False
        return [
            {
                "id": "1",
                "title": "Remote Work Policy",
                "category": "hr",
                "content": "...",
                "is_sensitive": False,
                "updated_at": "2026-01-01T00:00:00Z",
            }
        ]

    monkeypatch.setattr(
        "app.api.v1.endpoints.policy.policy_service.get_policies",
        fake_get_policies,
    )

    client = _override_user(app, roles=["TL"])
    r = client.get("/api/v1/policies")

    assert r.status_code == 200
    assert len(r.json()) == 1


def test_upsert_policy_requires_admin(app):
    client = _override_user(app, roles=["TL"])
    r = client.post(
        "/api/v1/policies",
        json={"title": "New Policy", "category": "hr", "content": "..."},
    )
    assert r.status_code == 403


def test_upsert_policy_succeeds_for_admin(app, monkeypatch):
    async def fake_upsert_policy(**kwargs):
        assert kwargs["updated_by"] == "test-user"
        return {
            "id": "1",
            "title": kwargs["title"],
            "category": kwargs["category"],
            "content": kwargs["content"],
            "is_sensitive": kwargs["is_sensitive"],
            "updated_at": "2026-01-01T00:00:00Z",
        }

    monkeypatch.setattr(
        "app.api.v1.endpoints.policy.policy_service.upsert_policy",
        fake_upsert_policy,
    )

    client = _override_user(app, roles=["ADMIN"])
    r = client.post(
        "/api/v1/policies",
        json={"title": "New Policy", "category": "hr", "content": "Details"},
    )

    assert r.status_code == 200
    assert r.json()["title"] == "New Policy"


def test_chat_endpoint_requires_permission(app):
    client = _override_user(app, roles=[])
    r = client.post("/api/v1/policies/chat", json={"question": "What is the leave policy?"})
    assert r.status_code == 403


def test_chat_endpoint_returns_answer(app, monkeypatch):
    async def fake_answer_policy_question(**kwargs):
        assert kwargs["can_view_sensitive"] is False
        return {"answer": "You get 12 days of paid leave.", "cached": False, "policy_ids": ["1"]}

    monkeypatch.setattr(
        "app.api.v1.endpoints.policy.policy_service.answer_policy_question",
        fake_answer_policy_question,
    )

    client = _override_user(app, roles=["TL"])
    r = client.post("/api/v1/policies/chat", json={"question": "What is the leave policy?"})

    assert r.status_code == 200
    body = r.json()
    assert body["answer"] == "You get 12 days of paid leave."
    assert body["policy_ids"] == ["1"]
