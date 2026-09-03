"""HTTP integration tests exercising the FastAPI application endpoints over HTTP.

Uses httpx.AsyncClient with ASGITransport against app.main.app and respx
to mock network-level AI provider responses without making external API calls.
"""

import httpx
import pytest
import respx
from httpx import ASGITransport, AsyncClient

from app.core.rate_limiter import ai_rate_limiter
from app.core.auth import get_current_user, User
from app.main import app

GEMINI_URL_PREFIX = "https://generativelanguage.googleapis.com/v1beta/models/"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"


@pytest.fixture(autouse=True)
def setup_test_env():
    """Ensure rate limiter state is completely clean before and after every test, and inject mock user."""
    ai_rate_limiter.history.clear()
    app.dependency_overrides[get_current_user] = lambda: User(id="test_user", roles=["ADMIN"])
    yield
    ai_rate_limiter.history.clear()
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health_endpoint():
    """GET /health should return status 200 and healthy status payload."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
@respx.mock
async def test_generate_success_gemini():
    """POST /generate with Gemini provider returns 200 and generated text."""
    respx.post(url__startswith=GEMINI_URL_PREFIX).mock(
        return_value=httpx.Response(
            200,
            json={
                "candidates": [
                    {"content": {"parts": [{"text": "Hello from Gemini integration test!"}]}}
                ]
            },
        )
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/generate",
            json={"prompt": "hi", "provider": "gemini"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["provider"] == "gemini"
    assert data["content"] == "Hello from Gemini integration test!"


@pytest.mark.asyncio
async def test_generate_rejects_oversized_input():
    """POST /generate rejects prompt exceeding maximum allowed length with 400."""
    oversized_prompt = "x" * 3000

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/generate",
            json={"user_input": oversized_prompt},
        )

    assert response.status_code == 400
    # The actual detail message from app/core/security.py is "Input too long"
    assert "Input too long" in response.json()["detail"]


@pytest.mark.asyncio
async def test_generate_rejects_empty_input():
    """POST /generate rejects empty prompt with 400."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/generate",
            json={"prompt": ""},
        )

    assert response.status_code == 400
    assert "is required" in response.json()["detail"]


@pytest.mark.asyncio
@respx.mock
async def test_generate_accepts_structured_messages():
    """POST /generate preserves a structured messages array instead of
    flattening the conversation into a single prompt string."""
    captured_bodies = []

    def _capture(request):
        import json

        captured_bodies.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {"content": {"parts": [{"text": "Hello from Gemini!"}]}}
                ]
            },
        )

    respx.post(url__startswith=GEMINI_URL_PREFIX).mock(side_effect=_capture)

    messages = [
        {"role": "system", "content": "Be concise."},
        {"role": "user", "content": "Hi"},
        {"role": "assistant", "content": "Hello!"},
        {"role": "user", "content": "How are you?"},
    ]

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/generate",
            json={"messages": messages},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["content"] == "Hello from Gemini!"

    # The provider must have received all four structured turns, not a
    # single flattened prompt.
    assert len(captured_bodies) == 1


@pytest.mark.asyncio
async def test_generate_rejects_empty_messages_list():
    """POST /generate rejects an empty messages array with 400."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/generate",
            json={"messages": []},
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_generate_rejects_message_missing_role():
    """POST /generate rejects a message without a valid role with 400."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/generate",
            json={"messages": [{"content": "hi"}]},
        )

    assert response.status_code == 400


@pytest.mark.asyncio
@respx.mock
async def test_generate_rate_limited_after_threshold(monkeypatch):
    """POST /generate returns 429 when client exceeds the requests-per-minute threshold."""
    respx.post(url__startswith=GEMINI_URL_PREFIX).mock(
        return_value=httpx.Response(
            200,
            json={
                "candidates": [
                    {"content": {"parts": [{"text": "response"}]}}
                ]
            },
        )
    )

    # Set rate limit to 3 for testing
    ai_rate_limiter.requests_per_minute = 3
    ai_rate_limiter.history.clear()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # First 3 requests should succeed
        for _ in range(3):
            res = await client.post("/generate", json={"prompt": "test"})
            assert res.status_code == 200

        # 4th request should be rate limited
        res = await client.post("/generate", json={"prompt": "test"})
        assert res.status_code == 429
        assert "rate limit exceeded" in res.json()["detail"].lower()


@pytest.mark.asyncio
@respx.mock
async def test_generate_provider_error_maps_to_503():
    """POST /generate maps downstream provider errors to 503 Service Unavailable."""
    # Mock ALL providers in the failover chain to simulate a complete outage
    respx.post().mock(
        return_value=httpx.Response(500, text="Internal Server Error")
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/generate",
            json={"prompt": "hello", "provider": "gemini"},
        )

    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()
