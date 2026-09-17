import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints.assignment_visuals import router
from app.core.auth import User, get_current_user
from app.core.rate_limiter import ai_rate_limiter
from app.providers.base import AIProviderError, ProviderAPIError, ProviderRateLimitError
from app.providers.gemini import GeminiProvider
from app.providers.registry import get_provider
from app.services import assignment_visuals as assignment_visuals_service
from app.services.assignment_visuals import (
    DuplicateGenerationError,
    generate_assignment_visual,
)


@pytest.fixture(autouse=True)
def _clear_in_memory_locks():
    """Each test starts with a clean dedup-lock slate."""
    assignment_visuals_service._in_memory_locks.clear()
    yield
    assignment_visuals_service._in_memory_locks.clear()


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: User(id="test_user", roles=["ADMIN"])
    app.dependency_overrides[ai_rate_limiter.check_rate_limit] = lambda: None
    return TestClient(app, raise_server_exceptions=False)


# ===========================================================================
# Endpoint-level tests
# ===========================================================================

def test_generate_visual_missing_topic(client):
    r = client.post("/assignments/generate-visual", json={})
    assert r.status_code == 400
    assert "topic or description is required" in r.json()["detail"]


def test_generate_visual_blank_topic(client):
    r = client.post("/assignments/generate-visual", json={"topic": "   "})
    assert r.status_code == 400


def test_generate_visual_success(client, monkeypatch):
    async def mock_generate(topic, user_id):
        return {"image_url": "https://example.com/image.png", "provider": "openai", "topic": topic}

    monkeypatch.setattr(
        "app.api.v1.endpoints.assignment_visuals.generate_assignment_visual", mock_generate
    )

    r = client.post("/assignments/generate-visual", json={"topic": "A poster about recycling"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "success"
    assert body["image_url"] == "https://example.com/image.png"
    assert body["provider"] == "openai"


def test_generate_visual_accepts_description_key(client, monkeypatch):
    async def mock_generate(topic, user_id):
        return {"image_url": "https://example.com/image.png", "provider": "openai", "topic": topic}

    monkeypatch.setattr(
        "app.api.v1.endpoints.assignment_visuals.generate_assignment_visual", mock_generate
    )

    r = client.post("/assignments/generate-visual", json={"description": "A poster about recycling"})
    assert r.status_code == 200


def test_generate_visual_duplicate_request_returns_409(client, monkeypatch):
    async def mock_generate(topic, user_id):
        raise DuplicateGenerationError()

    monkeypatch.setattr(
        "app.api.v1.endpoints.assignment_visuals.generate_assignment_visual", mock_generate
    )

    r = client.post("/assignments/generate-visual", json={"topic": "A poster about recycling"})
    assert r.status_code == 409
    assert "already in progress" in r.json()["detail"].lower()


def test_generate_visual_invalid_input_returns_400(client, monkeypatch):
    async def mock_generate(topic, user_id):
        raise ValueError("Input too long")

    monkeypatch.setattr(
        "app.api.v1.endpoints.assignment_visuals.generate_assignment_visual", mock_generate
    )

    r = client.post("/assignments/generate-visual", json={"topic": "x" * 3000})
    assert r.status_code == 400


def test_generate_visual_rate_limit(client, monkeypatch):
    async def mock_generate(topic, user_id):
        raise ProviderRateLimitError("Rate limit hit", "openai", status_code=429)

    monkeypatch.setattr(
        "app.api.v1.endpoints.assignment_visuals.generate_assignment_visual", mock_generate
    )

    r = client.post("/assignments/generate-visual", json={"topic": "A poster about recycling"})
    assert r.status_code == 429


def test_generate_visual_provider_failure_is_graceful(client, monkeypatch):
    """Provider/vendor failure should surface as a 503, not a hard crash --
    so the assignment creation flow the frontend is driving can continue
    without a visual, per the issue's acceptance criteria."""

    async def mock_generate(topic, user_id):
        raise AIProviderError("boom", "openai")

    monkeypatch.setattr(
        "app.api.v1.endpoints.assignment_visuals.generate_assignment_visual", mock_generate
    )

    r = client.post("/assignments/generate-visual", json={"topic": "A poster about recycling"})
    assert r.status_code == 503
    assert "temporarily unavailable" in r.json()["detail"].lower()


def test_generate_visual_oversized_provider_response(client, monkeypatch):
    async def mock_generate(topic, user_id):
        raise ProviderAPIError("too big", "openai", status_code=413)

    monkeypatch.setattr(
        "app.api.v1.endpoints.assignment_visuals.generate_assignment_visual", mock_generate
    )

    r = client.post("/assignments/generate-visual", json={"topic": "A poster about recycling"})
    assert r.status_code == 413


def test_generate_visual_requires_auth():
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[ai_rate_limiter.check_rate_limit] = lambda: None
    unauth_client = TestClient(app, raise_server_exceptions=False)

    r = unauth_client.post("/assignments/generate-visual", json={"topic": "A poster"})
    assert r.status_code == 401


# ===========================================================================
# Service-level tests (dedup locking + graceful provider failure)
# ===========================================================================

@pytest.mark.asyncio
async def test_generate_assignment_visual_success(monkeypatch):
    async def mock_generate_image(self, prompt, size="1024x1024", **kwargs):
        return {"url": "https://example.com/img.png", "revised_prompt": prompt, "model": "dall-e-3"}

    from app.providers.openai import OpenAIProvider

    monkeypatch.setattr(OpenAIProvider, "generate_image", mock_generate_image)

    result = await generate_assignment_visual("A poster about recycling", user_id="user-1")
    assert result["image_url"] == "https://example.com/img.png"
    assert result["provider"] == "openai"


@pytest.mark.asyncio
async def test_generate_assignment_visual_empty_topic_raises_value_error():
    with pytest.raises(ValueError):
        await generate_assignment_visual("   ", user_id="user-1")


@pytest.mark.asyncio
async def test_generate_assignment_visual_prevents_duplicate_in_flight_requests(monkeypatch):
    """Two concurrent requests for the same (user, topic) pair -- the second
    should be rejected as a duplicate rather than firing a second vendor
    call, per the issue's 'prevent accidental duplicate generation
    requests' requirement."""
    import asyncio

    from app.providers.openai import OpenAIProvider

    call_count = 0
    started = asyncio.Event()
    release = asyncio.Event()

    async def slow_generate_image(self, prompt, size="1024x1024", **kwargs):
        nonlocal call_count
        call_count += 1
        started.set()
        await release.wait()
        return {"url": "https://example.com/img.png", "revised_prompt": prompt, "model": "dall-e-3"}

    monkeypatch.setattr(OpenAIProvider, "generate_image", slow_generate_image)

    first = asyncio.create_task(
        generate_assignment_visual("Same topic here", user_id="user-1")
    )
    await started.wait()

    with pytest.raises(DuplicateGenerationError):
        await generate_assignment_visual("Same topic here", user_id="user-1")

    release.set()
    result = await first
    assert result["image_url"] == "https://example.com/img.png"
    assert call_count == 1


@pytest.mark.asyncio
async def test_generate_assignment_visual_releases_lock_after_success(monkeypatch):
    from app.providers.openai import OpenAIProvider

    async def mock_generate_image(self, prompt, size="1024x1024", **kwargs):
        return {"url": "https://example.com/img.png", "revised_prompt": prompt, "model": "dall-e-3"}

    monkeypatch.setattr(OpenAIProvider, "generate_image", mock_generate_image)

    await generate_assignment_visual("Another topic", user_id="user-2")
    # Lock must be released so a follow-up request for the same topic works.
    await generate_assignment_visual("Another topic", user_id="user-2")


@pytest.mark.asyncio
async def test_generate_assignment_visual_releases_lock_after_failure(monkeypatch):
    from app.providers.openai import OpenAIProvider

    async def failing_generate_image(self, prompt, size="1024x1024", **kwargs):
        raise AIProviderError("vendor down", "openai")

    monkeypatch.setattr(OpenAIProvider, "generate_image", failing_generate_image)

    with pytest.raises(AIProviderError):
        await generate_assignment_visual("Flaky topic", user_id="user-3")

    # Lock released even on failure -- a retry shouldn't be blocked as a
    # "duplicate" forever.
    with pytest.raises(AIProviderError):
        await generate_assignment_visual("Flaky topic", user_id="user-3")


@pytest.mark.asyncio
async def test_base_provider_generate_image_not_supported():
    """Providers without image-generation support fail gracefully with a
    domain error instead of an unhandled AttributeError/NotImplementedError."""
    provider = GeminiProvider(api_key="test-key")
    with pytest.raises(AIProviderError):
        await provider.generate_image("a picture of a cat")
