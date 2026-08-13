from datetime import datetime, timedelta
from typing import Optional
import os
from app.core.config import settings, GEMINI_API_KEY, PLACEHOLDER_KEYS
from app.providers.gemini import call_gemini
from app.providers.nvidia import call_nvidia

# Build the provider order from settings (primary first, then active fallbacks)
AI_PROVIDER_ORDER = [settings.PRIMARY_AI_PROVIDER] + list(settings.ACTIVE_FALLBACK_PROVIDERS)


def is_placeholder(key: Optional[str]) -> bool:
    """Return True if the key is missing or still a placeholder value."""
    if not key:
        return True
    return key.strip() in PLACEHOLDER_KEYS


# ── Simple in-memory cache ────────────────────────────────────────────────────
_cache: dict = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


def _make_cache_key(messages: list[dict]) -> str:
    import hashlib, json
    return hashlib.sha256(json.dumps(messages, sort_keys=True).encode()).hexdigest()


def _get_cached(messages: list[dict]) -> Optional[dict]:
    key = _make_cache_key(messages)
    entry = _cache.get(key)
    if entry and datetime.utcnow() < entry["expires_at"]:
        return entry["value"]
    return None


def _set_cached(messages: list[dict], value: dict):
    key = _make_cache_key(messages)
    _cache[key] = {
        "value": value,
        "expires_at": datetime.utcnow() + timedelta(seconds=CACHE_TTL_SECONDS),
    }


# ── Circuit breaker state ─────────────────────────────────────────────────────
_failure_state: dict = {}
FAILURE_LIMIT = 3
COOLDOWN_SECONDS = 300  # 5 minutes


def _is_provider_open(name: str) -> bool:
    state = _failure_state.get(name)
    if not state:
        return True
    if datetime.utcnow() >= state["disabled_until"]:
        _failure_state.pop(name, None)
        return True
    return False


def _record_failure(name: str, error: str):
    state = _failure_state.get(name, {"failures": 0, "last_error": None, "disabled_until": None})
    state["failures"] += 1
    state["last_error"] = error
    if state["failures"] >= FAILURE_LIMIT:
        state["disabled_until"] = datetime.utcnow() + timedelta(seconds=COOLDOWN_SECONDS)
    _failure_state[name] = state


def _record_success(name: str):
    _failure_state.pop(name, None)


# ── Provider registry ─────────────────────────────────────────────────────────
PROVIDER_REGISTRY = {
    "nvidia": {
        "key": lambda: os.environ.get("NVIDIA_API_KEY", ""),
        "call": call_nvidia,
    },
    "gemini": {
        "key": lambda: GEMINI_API_KEY,
        "call": call_gemini,
    },
}


# ── Main entry point ──────────────────────────────────────────────────────────
async def generate_ai_response(messages: list[dict]) -> dict:
    """
    Try each provider in order (from AI_PROVIDER_ORDER env var).
    Returns: { provider, content, cached }
    Ported from reference/aiProviderService.js generateAIResponse()
    """
    # Validate and sanitize messages
    MAX_MESSAGES = 32
    MAX_MESSAGE_CHARS = 4000
    MAX_TOTAL_CHARS = 32000

    sanitized = []
    for msg in messages[-MAX_MESSAGES:]:
        sanitized.append({
            "role": msg.get("role", "user"),
            "content": str(msg.get("content", ""))[:MAX_MESSAGE_CHARS],
        })

    total_chars = sum(len(m["content"]) for m in sanitized)
    if total_chars > MAX_TOTAL_CHARS:
        raise ValueError("Prompt too long")

    # Check cache
    cached = _get_cached(sanitized)
    if cached:
        return {**cached, "cached": True}

    errors = []

    for provider_name in AI_PROVIDER_ORDER:
        provider_name = provider_name.strip()
        provider = PROVIDER_REGISTRY.get(provider_name)

        if not provider:
            continue

        key = provider["key"]()
        if is_placeholder(key):
            errors.append({"provider": provider_name, "reason": "missing_api_key"})
            continue

        if not _is_provider_open(provider_name):
            errors.append({"provider": provider_name, "reason": "circuit_open"})
            continue

        try:
            content = await provider["call"](sanitized)
            _record_success(provider_name)

            result = {"provider": provider_name, "content": content, "cached": False}
            _set_cached(sanitized, result)
            return result

        except Exception as e:
            _record_failure(provider_name, str(e))
            errors.append({"provider": provider_name, "reason": str(e)})
            print(f"[AI] Provider failed: {provider_name} — {e}")

    raise RuntimeError(f"All AI providers unavailable. Errors: {errors}")


def get_provider_health() -> list[dict]:
    """Returns health status of all configured providers."""
    health = []
    for name in AI_PROVIDER_ORDER:
        provider = PROVIDER_REGISTRY.get(name.strip())
        configured = bool(provider and not is_placeholder(provider["key"]()))
        available = configured and _is_provider_open(name)
        state = _failure_state.get(name, {})
        health.append({
            "name": name,
            "configured": configured,
            "available": available,
            "failures": state.get("failures", 0),
            "last_error": state.get("last_error"),
        })
    return health
