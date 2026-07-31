import pytest

from app.providers.base import (
    BaseAIProvider,
    ProviderRateLimitError,
)


def test_rate_limit_error_properties():
    err = ProviderRateLimitError(
        "Rate limit exceeded",
        provider_name="Gemini",
        status_code=429,
    )

    assert err.message == "Rate limit exceeded"
    assert err.provider_name == "Gemini"
    assert err.status_code == 429


def test_base_provider_cannot_be_instantiated():
    with pytest.raises(TypeError):
        BaseAIProvider("dummy-key", "gemini")


class IncompleteProvider(BaseAIProvider):
    pass


def test_incomplete_provider_cannot_be_instantiated():
    with pytest.raises(TypeError):
        IncompleteProvider("dummy-key", "gemini")