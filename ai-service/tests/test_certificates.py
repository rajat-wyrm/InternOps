import pytest

from fastapi import HTTPException

from app.services.certificates import generate_certificate_design
from app.providers.orchestrator import ai_orchestrator


@pytest.mark.asyncio
async def test_certificate_generation_uses_orchestrator(monkeypatch):
    async def mock_generate(messages):
        prompt = messages[0]["content"]

        assert "test task" in prompt.lower()

        return "Generated certificate design", "mock-provider"

    monkeypatch.setattr(
        ai_orchestrator,
        "generate_chat_with_fallback",
        mock_generate,
    )

    result = await generate_certificate_design("Test task")

    assert result == "Generated certificate design"


@pytest.mark.asyncio
async def test_certificate_generation_returns_502_on_provider_failure(monkeypatch):
    async def mock_generate(messages):
        raise Exception("Provider failed")

    monkeypatch.setattr(
        ai_orchestrator,
        "generate_chat_with_fallback",
        mock_generate,
    )

    with pytest.raises(HTTPException) as exc_info:
        await generate_certificate_design("Test task")

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "Failed to generate certificate design."