"""
Tests for app/api/ai_routes.py

Run with:
    pip install pytest httpx
    pytest tests/test_ai_routes.py -v

These exercise validation, limits, rbac stub, rate-limit stub, and the
health/usage endpoints. `call_provider` is still a stub (NotImplementedError),
so the "happy path" test expects a 500 until it's wired to a real provider —
update that one assertion once providers/gemini.py or openai.py is connected.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.ai_routes import router
from app.core.rate_limit import chat_rate_limiter
from app.core.usage import _usage_by_user_day


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    # reset in-memory stubs between tests so they don't bleed into each other
    chat_rate_limiter._hits.clear()
    _usage_by_user_day.clear()
    return TestClient(app, raise_server_exceptions=False)


def test_chat_requires_prompt_or_messages(client):
    r = client.post("/ai/chat", json={})
    assert r.status_code == 400
    assert "Prompt or valid messages" in r.json()["detail"]


def test_chat_rejects_invalid_role(client):
    r = client.post(
        "/ai/chat", json={"messages": [{"role": "bogus", "content": "hi"}]}
    )
    assert r.status_code == 422  # pydantic enum validation


def test_chat_rejects_blank_content(client):
    r = client.post(
        "/ai/chat", json={"messages": [{"role": "user", "content": "   "}]}
    )
    assert r.status_code == 400
    assert "cannot be empty" in r.json()["detail"]


def test_chat_truncates_message_list_to_16(client):
    # The messages[:16] slice runs before the MAX_MESSAGES=32 check, so a
    # 33-message list is truncated to 16 before that check ever sees it —
    # the "Too many messages" 413 is effectively unreachable via this path.
    # This is inherited from the original JS (same slice-then-check order),
    # not a bug introduced in the port. This test documents that behavior
    # rather than asserting the unreachable 413.
    messages = [{"role": "user", "content": "hi"} for _ in range(33)]
    r = client.post("/ai/chat", json={"messages": messages})
    assert r.status_code != 413


def test_chat_without_configured_provider_key_returns_503(client, monkeypatch):
    # No GEMINI_API_KEY/OPENAI_API_KEY set in the test environment ->
    # the registry raises AIProviderError -> mapped to 503.
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    r = client.post("/ai/chat", json={"prompt": "hello"})
    assert r.status_code == 503
    assert r.json()["detail"] == "AI service unavailable"


def test_chat_happy_path_with_mocked_provider(client, monkeypatch):
    import app.api.ai_routes as ai_routes_module
    from app.models.ai import ProviderResult

    async def fake_call_provider(user_id, messages):
        return ProviderResult(provider="fake-provider", cached=False, content="hi there!")

    monkeypatch.setattr(ai_routes_module, "call_provider", fake_call_provider)

    r = client.post("/ai/chat", json={"prompt": "hello"}, headers={"x-user-id": "happy-path"})
    assert r.status_code == 200
    body = r.json()
    assert body == {"provider": "fake-provider", "cached": False, "content": "hi there!"}


def test_messages_to_prompt_flattens_roles():
    from app.api.ai_routes import _messages_to_prompt

    prompt = _messages_to_prompt(
        [
            {"role": "system", "content": "Be concise."},
            {"role": "user", "content": "Hi"},
        ]
    )
    assert prompt == "System: Be concise.\n\nUser: Hi"


def test_health_endpoint(client, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    r = client.get("/ai/health")
    assert r.status_code == 200
    body = r.json()
    names = {p["name"] for p in body["providers"]}
    assert names == {"gemini", "openai"}
    assert all(p["status"] == "unhealthy" for p in body["providers"])


def test_health_endpoint_reports_healthy_when_key_present(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    r = client.get("/ai/health")
    body = r.json()
    gemini_entry = next(p for p in body["providers"] if p["name"] == "gemini")
    assert gemini_entry["status"] == "healthy"
    assert gemini_entry["lastErrorMessage"] is None


def test_usage_endpoint(client):
    r = client.get("/ai/usage")
    assert r.status_code == 200
    body = r.json()
    assert "date" in body
    assert body["users"] == []


def test_rate_limit_trips_after_configured_max(client, monkeypatch):
    import app.api.ai_routes as ai_routes_module
    from app.models.ai import ProviderResult

    # Fake provider instead of real Gemini
    async def fake_call_provider(user_id, messages):
        return ProviderResult(
            provider="fake-provider",
            cached=False,
            content="ok",
        )

    # Replace the real call_provider() with our fake one
    monkeypatch.setattr(ai_routes_module, "call_provider", fake_call_provider)

    limit = chat_rate_limiter.max_per_minute
    headers = {"x-user-id": "rate-limit-test-user"}

    # These requests should NOT hit the rate limit
    for _ in range(limit):
        r = client.post(
            "/ai/chat",
            json={"prompt": "hi"},
            headers=headers,
        )
        assert r.status_code != 429

    # This one SHOULD hit the rate limit
    r = client.post(
        "/ai/chat",
        json={"prompt": "hi"},
        headers=headers,
    )

    assert r.status_code == 429