import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.v1.endpoints.generate import router
from app.providers.orchestrator import ai_orchestrator
from app.providers.base import AIProviderError, ProviderRateLimitError, ProviderAPIError
from app.core.auth import get_current_user, User
from app.core.rate_limiter import ai_rate_limiter


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: User(id="test_user", roles=["ADMIN"])
    app.dependency_overrides[ai_rate_limiter.check_rate_limit] = lambda: None
    return TestClient(app, raise_server_exceptions=False)


def test_generate_endpoint_missing_prompt(client):
    r = client.post("/generate", json={})
    assert r.status_code == 400
    assert "Prompt or user_input is required" in r.json()["detail"]


def test_generate_endpoint_success(client, monkeypatch):
    async def mock_generate(*args, **kwargs):
        return "Generated response", "mock-gemini"

    monkeypatch.setattr(ai_orchestrator, "generate_text_with_fallback", mock_generate)

    # Test with 'prompt' key
    r = client.post("/generate", json={"prompt": "Write a poem"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "success"
    assert body["provider"] == "mock-gemini"
    assert body["content"] == "Generated response"

    # Test with 'user_input' key
    r = client.post("/generate", json={"user_input": "Write a poem"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "success"
    assert body["provider"] == "mock-gemini"
    assert body["content"] == "Generated response"


def test_generate_endpoint_rate_limit(client, monkeypatch):
    async def mock_generate(*args, **kwargs):
        raise ProviderRateLimitError("Rate limit hit", "mock-provider", status_code=429)

    monkeypatch.setattr(ai_orchestrator, "generate_text_with_fallback", mock_generate)

    r = client.post("/generate", json={"prompt": "Write a poem"})
    assert r.status_code == 429
    assert "rate limit exceeded" in r.json()["detail"].lower()


def test_generate_endpoint_api_error_413(client, monkeypatch):
    async def mock_generate(*args, **kwargs):
        raise ProviderAPIError("Oversized response", "mock-provider", status_code=413)

    monkeypatch.setattr(ai_orchestrator, "generate_text_with_fallback", mock_generate)

    r = client.post("/generate", json={"prompt": "Write a poem"})
    assert r.status_code == 413
    assert "too large" in r.json()["detail"].lower()


def test_generate_endpoint_generic_provider_error(client, monkeypatch):
    async def mock_generate(*args, **kwargs):
        raise AIProviderError("Connection error", "mock-provider")

    monkeypatch.setattr(ai_orchestrator, "generate_text_with_fallback", mock_generate)

    r = client.post("/generate", json={"prompt": "Write a poem"})
    assert r.status_code == 503
    assert "unavailable" in r.json()["detail"].lower()
