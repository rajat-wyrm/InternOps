import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints.certificates import router
from app.core.auth import User, get_current_user
from app.providers.orchestrator import ai_orchestrator


@pytest.fixture
def app():
    fastapi_app = FastAPI()
    fastapi_app.include_router(router, prefix="/certificates")
    return fastapi_app


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def admin_client(app):
    app.dependency_overrides[get_current_user] = lambda: User(
        id="test-admin", roles=["ADMIN"]
    )
    return TestClient(app, raise_server_exceptions=False)


def test_validate_endpoint_requires_auth(client):
    r = client.post(
        "/certificates/validate",
        json={"name": "Asha", "company": "Acme", "achievement": "did great work"},
    )
    assert r.status_code == 401


def test_validate_endpoint_success(admin_client, monkeypatch):
    async def mock_generate(messages):
        return "Polished sentence.", "mock-provider"

    monkeypatch.setattr(ai_orchestrator, "generate_chat_with_fallback", mock_generate)

    r = admin_client.post(
        "/certificates/validate",
        json={"name": "Asha", "company": "Acme", "achievement": "did great work"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["text"] == "Polished sentence."


def test_validate_endpoint_rejects_missing_fields(admin_client):
    r = admin_client.post("/certificates/validate", json={"name": "", "company": "Acme", "achievement": "x"})
    assert r.status_code == 422


def test_generate_achievement_endpoint(admin_client, monkeypatch):
    async def mock_generate(messages):
        return "Great job!", "mock-provider"

    monkeypatch.setattr(ai_orchestrator, "generate_chat_with_fallback", mock_generate)

    r = admin_client.post(
        "/certificates/generate-achievement",
        json={
            "recipient_name": "Asha",
            "recognition_type": "Internship",
            "core_achievement": "shipping a feature",
        },
    )
    assert r.status_code == 200
    assert r.json()["data"]["statement"] == "Great job!"


def test_tone_customize_invalid_tone_returns_error_payload(admin_client):
    r = admin_client.post(
        "/certificates/tone-customize",
        json={
            "recipient_name": "Asha",
            "company_name": "Acme",
            "tone": "Sarcastic",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is False
    assert "Invalid tone" in body["error"]


def test_tones_endpoint(admin_client):
    r = admin_client.get("/certificates/tones")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert "Professional" in body["data"]


def test_languages_endpoint(admin_client):
    r = admin_client.get("/certificates/languages")
    assert r.status_code == 200
    assert "English" in r.json()["data"]


def test_design_templates_endpoint(admin_client):
    r = admin_client.get("/certificates/design-templates")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert len(body["data"]) > 0
    assert "name" in body["data"][0]


def test_preview_endpoint_does_not_require_ai(admin_client):
    r = admin_client.post(
        "/certificates/preview",
        json={"recipient_name": "Asha", "template_name": "Oxford Blue"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert "Asha" in body["data"]["html"]


def test_match_template_endpoint(admin_client, monkeypatch):
    async def mock_generate(messages):
        raise Exception("provider down")

    monkeypatch.setattr(ai_orchestrator, "generate_chat_with_fallback", mock_generate)

    r = admin_client.post(
        "/certificates/match-template",
        json={"certificate_type": "Internship"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert "best_match" in body["data"]
    assert len(body["data"]["top_3"]) == 3
