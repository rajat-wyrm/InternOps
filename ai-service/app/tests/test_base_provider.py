import pytest

from app.providers.base import (
    AIProviderError,
    BaseAIProvider,
    ProviderAPIError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)


class DummyProvider(BaseAIProvider):
    async def generate_text(self, prompt: str, temperature: float = 0.7, **kwargs) -> str:
        return "dummy response"

    async def generate_json(self, prompt: str, schema, temperature: float = 0.2, **kwargs):
        return {"status": "ok"}


def test_provider_error_properties():
    error = AIProviderError("Something went wrong", "dummy", 500)

    assert error.message == "Something went wrong"
    assert error.provider_name == "dummy"
    assert error.status_code == 500


def test_provider_api_error_is_ai_provider_error():
    error = ProviderAPIError("API error", "dummy")

    assert isinstance(error, AIProviderError)


def test_provider_rate_limit_error_is_ai_provider_error():
    error = ProviderRateLimitError("Rate limit exceeded", "dummy")

    assert isinstance(error, AIProviderError)


def test_provider_timeout_error_is_ai_provider_error():
    error = ProviderTimeoutError("Timeout", "dummy")

    assert isinstance(error, AIProviderError)


def test_dummy_provider_initialization():
    provider = DummyProvider("test_key", "test_model")

    assert provider.api_key == "test_key"
    assert provider.model_name == "test_model"


@pytest.mark.asyncio
async def test_generate_text():
    provider = DummyProvider("test_key", "test_model")

    result = await provider.generate_text("Hello")

    assert result == "dummy response"


@pytest.mark.asyncio
async def test_generate_json():
    provider = DummyProvider("test_key", "test_model")

    result = await provider.generate_json("Hello", {})

    assert result == {"status": "ok"}