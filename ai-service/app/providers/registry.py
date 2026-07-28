"""
Provider registry — selects and builds the configured AI provider adapter.

Nothing in base.py/gemini.py/openai.py handles *selection* (which provider
to use, where the API key comes from) — that's added here rather than
inside the adapters themselves, so the adapters stay focused purely on
"how do I talk to this vendor."

Env vars:
  AI_PROVIDER       - "gemini" (default) or "openai"
  GEMINI_API_KEY     - required if using gemini
  OPENAI_API_KEY      - required if using openai
  GEMINI_MODEL         - optional override (defaults to GeminiProvider's default)
  OPENAI_MODEL          - optional override (defaults to OpenAIProvider's default)

TODO(providers): no fallback-to-secondary-provider logic yet (e.g. if
gemini's key is missing/rate-limited, try openai) — every call currently
uses a single configured provider. TODO(providers): no instance caching/
pooling — a fresh adapter is built per call, which is fine for now since
the adapters are lightweight (just holds an api_key + model_name + opens
an httpx.AsyncClient per request), but worth revisiting under load.
"""

import os
from typing import Dict, Optional, Type

from app.providers.base import AIProviderError, BaseAIProvider
from app.providers.gemini import GeminiProvider
from app.providers.openai import OpenAIProvider

_PROVIDER_CLASSES: Dict[str, Type[BaseAIProvider]] = {
    "gemini": GeminiProvider,
    "openai": OpenAIProvider,
}

_API_KEY_ENV_VAR: Dict[str, str] = {
    "gemini": "GEMINI_API_KEY",
    "openai": "OPENAI_API_KEY",
}

_MODEL_ENV_VAR: Dict[str, str] = {
    "gemini": "GEMINI_MODEL",
    "openai": "OPENAI_MODEL",
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


def get_configured_providers_health() -> list:
    """Lightweight config-presence health check.

    Reports whether each known provider has an API key configured. This
    does NOT make a live API call to the vendor — a real ping would cost
    quota/latency on every hit to /ai/health. Swap this out for an actual
    `generate_text("ping")` call per provider if that tradeoff is wrong
    for this service.
    """
    report = []
    for name, key_var in _API_KEY_ENV_VAR.items():
        has_key = bool(os.environ.get(key_var))
        report.append(
            {
                "name": name,
                "available": has_key,
                "lastError": None
                if has_key
                else {"message": f"{key_var} is not configured"},
            }
        )
    return report
