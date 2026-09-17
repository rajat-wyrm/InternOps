"""
Tests for issue #1888: registry.get_provider() must use settings.PRIMARY_AI_PROVIDER
as its single source of truth, instead of a separate AI_PROVIDER env var.
"""

import os

import pytest

from app.core import config
from app.providers import registry
from app.providers.openai import OpenAIProvider
from app.providers.gemini import GeminiProvider


def test_get_provider_defaults_to_settings_primary_ai_provider(monkeypatch):
    """With no explicit name, get_provider() should follow settings.PRIMARY_AI_PROVIDER."""
    monkeypatch.setattr(config.settings, "PRIMARY_AI_PROVIDER", "openai")

    provider = registry.get_provider()

    assert isinstance(provider, OpenAIProvider)


def test_get_provider_ignores_legacy_ai_provider_env_var(monkeypatch):
    """A stray AI_PROVIDER env var must no longer influence provider selection."""
    monkeypatch.setattr(config.settings, "PRIMARY_AI_PROVIDER", "gemini")
    monkeypatch.setenv("AI_PROVIDER", "openai")

    provider = registry.get_provider()

    assert isinstance(provider, GeminiProvider)


def test_get_provider_explicit_name_overrides_default(monkeypatch):
    """An explicitly requested provider name still wins over the configured default."""
    monkeypatch.setattr(config.settings, "PRIMARY_AI_PROVIDER", "gemini")

    provider = registry.get_provider("openai")

    assert isinstance(provider, OpenAIProvider)
