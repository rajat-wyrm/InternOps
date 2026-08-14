import pytest

from app.providers.base import (
    AIProviderError,
    BaseAIProvider,
    ProviderAPIError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)


class DummyProvider(BaseAIProvider):
    async def generate_chat(self, messages: list[dict], temperature: float = 0.7, **kwargs) -> str:
        return "dummy response"

    async def generate_json(self, prompt: str, schema, temperature: float = 0.2, **kwargs):
        return {"status": "ok"}


class IncompleteProvider(BaseAIProvider):
    pass


def test_provider_error_properties():
    error = AIProviderError("Something went wrong", "dummy", 500)
    assert error.message == "Something went wrong"
    assert error.provider_name == "dummy"
    assert error.status_code == 500


def test_provider_api_error_is_ai_provider_error():
    error = ProviderAPIError("API error", "dummy")
    assert isinstance(error, AIProviderError)


def test_provider_rate_limit_error_is_ai_provider_error():
    error = ProviderRateLimitError("Rate limit exceeded", "dummy", 429)
    assert isinstance(error, AIProviderError)
    assert error.message == "Rate limit exceeded"
    assert error.provider_name == "dummy"
    assert error.status_code == 429


def test_provider_timeout_error_is_ai_provider_error():
    error = ProviderTimeoutError("Timeout", "dummy")
    assert isinstance(error, AIProviderError)


def test_dummy_provider_initialization():
    provider = DummyProvider("test_key", "test_model")
    assert provider.api_key == "test_key"
    assert provider.model_name == "test_model"


def test_base_provider_cannot_be_instantiated():
    with pytest.raises(TypeError):
        BaseAIProvider("dummy-key", "gemini")


def test_incomplete_provider_cannot_be_instantiated():
    with pytest.raises(TypeError):
        IncompleteProvider("dummy-key", "gemini")


@pytest.mark.asyncio
async def test_generate_chat():
    provider = DummyProvider("test_key", "test_model")
    result = await provider.generate_chat([{"role": "user", "content": "Hello"}])
    assert result == "dummy response"


@pytest.mark.asyncio
async def test_generate_json():
    provider = DummyProvider("test_key", "test_model")
    result = await provider.generate_json("Hello", {})
    assert result == {"status": "ok"}