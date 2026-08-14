"""
Provider registry — selects and builds the configured AI provider adapter.

Nothing in base.py/gemini.py/openai.py handles *selection* (which provider
to use, where the API key comes from) — that's added here rather than
inside the adapters themselves, so the adapters stay focused purely on
"how do I talk to this vendor."

Env vars:
  AI_PROVIDER        - "gemini" (default) or any supported provider name
  <PROVIDER>_API_KEY - required for each provider (HUGGINGFACE uses _TOKEN)
  <PROVIDER>_MODEL   - optional override (defaults to adapter's default)
"""

import os
from typing import Dict, Optional, Type

from app.providers.base import AIProviderError, BaseAIProvider
from app.providers.gemini import GeminiProvider
from app.providers.openai import OpenAIProvider
from app.providers.groq import GroqProvider
from app.providers.anthropic import AnthropicProvider
from app.providers.deepseek import DeepSeekProvider
from app.providers.huggingface import HuggingFaceProvider

_PROVIDER_CLASSES: Dict[str, Type[BaseAIProvider]] = {
    "gemini": GeminiProvider,
    "openai": OpenAIProvider,
    "groq": GroqProvider,
    "anthropic": AnthropicProvider,
    "deepseek": DeepSeekProvider,
    "huggingface": HuggingFaceProvider,
}

_API_KEY_ENV_VAR: Dict[str, str] = {
    "gemini": "GEMINI_API_KEY",
    "openai": "OPENAI_API_KEY",
    "groq": "GROQ_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "huggingface": "HUGGINGFACE_TOKEN",
}

_MODEL_ENV_VAR: Dict[str, str] = {
    "gemini": "GEMINI_MODEL",
    "openai": "OPENAI_MODEL",
    "groq": "GROQ_MODEL",
    "anthropic": "ANTHROPIC_MODEL",
    "deepseek": "DEEPSEEK_MODEL",
    "huggingface": "HUGGINGFACE_MODEL",
}


def _build_provider(name: str) -> BaseAIProvider:
    name = name.lower()
    provider_cls = _PROVIDER_CLASSES.get(name)
    if provider_cls is None:
        raise AIProviderError(
            f"Unknown provider '{name}' (expected one of {list(_PROVIDER_CLASSES)})",
            provider_name=name,
        )

    api_key = os.environ.get(_API_KEY_ENV_VAR[name])
    if not api_key:
        raise AIProviderError(
            f"{_API_KEY_ENV_VAR[name]} is not configured", provider_name=name
        )

    kwargs = {"api_key": api_key}
    model_name = os.environ.get(_MODEL_ENV_VAR[name])
    if model_name:
        kwargs["model_name"] = model_name

    return provider_cls(**kwargs)


def get_provider(name: Optional[str] = None) -> BaseAIProvider:
    """Build the configured provider adapter.

    Raises AIProviderError if the requested (or default) provider has no
    API key configured — callers should let that propagate to the route's
    error handling rather than catching it here.
    """
    return _build_provider(name or os.environ.get("AI_PROVIDER", "gemini"))


def has_adapter(name: str) -> bool:
    """Check whether a provider adapter class is registered for the given name."""
    return name.lower() in _PROVIDER_CLASSES


def get_configured_providers_health() -> list:
    """Return lightweight health information for configured providers.

    Reports whether each known provider has an API key configured. This
    does NOT make a live API call to the vendor — a real ping would cost
    quota/latency on every hit to /ai/health. Swap this out for an actual
    `generate_chat("ping")` call per provider if that tradeoff is wrong
    for this service.
    """
    report = []

    for name, key_var in _API_KEY_ENV_VAR.items():
        has_key = bool(os.environ.get(key_var))

        report.append(
            {
                "name": name,
                "status": "healthy" if has_key else "unhealthy",
                "lastErrorMessage": None
                if has_key
                else f"{key_var} is not configured",
            }
        )

    return report