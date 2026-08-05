import os
import warnings
import logging
from typing import Any, List, Optional
from dotenv import load_dotenv
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Setup module logger
logger = logging.getLogger(__name__)

# Load .env file using dotenv to ensure os.environ is populated
load_dotenv()

# Maximum AI requests allowed per minute for a user/client
RATE_LIMIT_PER_MINUTE = int(
    os.getenv("RATE_LIMIT_PER_MINUTE", "15")
)

# ==============================================================================
# Centralized Configuration Constraints
# ==============================================================================
SUPPORTED_PROVIDERS = {"gemini", "groq", "openai", "anthropic", "deepseek", "huggingface"}

DEFAULT_MODELS = {
    "gemini": "gemini-2.0-flash",
    "groq": "llama-3.3-70b-versatile",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-sonnet-latest",
    "deepseek": "deepseek-chat",
    "huggingface": "meta-llama/Llama-3-8b-instruct"
}

PLACEHOLDER_KEYS = {
    "your_gemini_api_key",
    "your_groq_api_key",
    "your_openai_api_key",
    "your_anthropic_api_key",
    "your_deepseek_api_key",
    "your_huggingface_token"
}

def _is_valid_key(key: Optional[str]) -> bool:
    """Return True if the given key/token is present and not a placeholder."""
    if not key:
        return False
    key_stripped = key.strip()
    if not key_stripped or key_stripped in PLACEHOLDER_KEYS:
        return False
    return True


def _get_key_attr(provider_name: str) -> str:
    """Return the Settings attribute name holding the credential for a provider."""
    provider_clean = provider_name.strip().lower()
    if provider_clean == "huggingface":
        return "HUGGINGFACE_TOKEN"
    return f"{provider_clean.upper()}_API_KEY"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "InternOps AI Service"
    API_V1_STR: str = "/api/v1"

    # Strategy Configuration
    PRIMARY_AI_PROVIDER: str = "gemini"
    FALLBACK_AI_PROVIDERS: Any = ["groq", "openai", "anthropic"]
    ACTIVE_FALLBACK_PROVIDERS: List[str] = []

    # API Keys & Tokens
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    DEEPSEEK_API_KEY: Optional[str] = None
    HUGGINGFACE_TOKEN: Optional[str] = None

    # Model Configuration
    GEMINI_MODEL: Optional[str] = None
    GROQ_MODEL: Optional[str] = None
    OPENAI_MODEL: Optional[str] = None
    ANTHROPIC_MODEL: Optional[str] = None
    DEEPSEEK_MODEL: Optional[str] = None
    HUGGINGFACE_MODEL: Optional[str] = None

    # Auth
    JWT_SECRET: str = ""

    # Host/Port/Redis configs
    AI_SERVICE_HOST: str = "0.0.0.0"
    AI_SERVICE_PORT: int = 8000
    DATABASE_URL: Optional[str] = None
    REDIS_URL: Optional[str] = None
    AI_CACHE_TTL: int = 3600

    # Circuit Breaker Configuration
    AI_PROVIDER_FAILURE_LIMIT: int = 3
    AI_PROVIDER_COOLDOWN_MS: float = 300000.0

    @field_validator("AI_PROVIDER_FAILURE_LIMIT", mode="before")
    @classmethod
    def validate_failure_limit(cls, v):
        if isinstance(v, str):
            try:
                v = int(v)
            except ValueError:
                raise ValueError("AI_PROVIDER_FAILURE_LIMIT must be a valid integer")
        if not isinstance(v, (int, float)) or isinstance(v, bool):
            raise ValueError("AI_PROVIDER_FAILURE_LIMIT must be a number")
        if v <= 0:
            raise ValueError("AI_PROVIDER_FAILURE_LIMIT must be greater than 0")
        return int(v)

    @field_validator("AI_PROVIDER_COOLDOWN_MS", mode="before")
    @classmethod
    def validate_cooldown_ms(cls, v):
        if isinstance(v, str):
            try:
                v = float(v)
            except ValueError:
                raise ValueError("AI_PROVIDER_COOLDOWN_MS must be a valid number")
        if not isinstance(v, (int, float)) or isinstance(v, bool):
            raise ValueError("AI_PROVIDER_COOLDOWN_MS must be a number")
        if v <= 0:
            raise ValueError("AI_PROVIDER_COOLDOWN_MS must be greater than 0")
        return float(v)

    @field_validator("PRIMARY_AI_PROVIDER", mode="before")
    @classmethod
    def clean_primary_provider(cls, v):
        if isinstance(v, str):
            v_clean = v.strip().lower()
            if v_clean not in SUPPORTED_PROVIDERS:
                raise ValueError(
                    f"PRIMARY_AI_PROVIDER '{v}' is not supported. Must be one of {SUPPORTED_PROVIDERS}"
                )
            return v_clean
        return v

    @field_validator("FALLBACK_AI_PROVIDERS", mode="before")
    @classmethod
    def parse_fallback_providers(cls, v):
        if isinstance(v, str):
            if not v.strip():
                return []
            providers = []
            for p in v.split(","):
                p_clean = p.strip().lower()
                if p_clean:
                    if p_clean not in SUPPORTED_PROVIDERS:
                        raise ValueError(
                            f"Fallback provider '{p.strip()}' is not supported. Must be one of {SUPPORTED_PROVIDERS}"
                        )
                    if p_clean not in providers:
                        providers.append(p_clean)
            return providers
        elif isinstance(v, list):
            providers = []
            for p in v:
                if isinstance(p, str):
                    p_clean = p.strip().lower()
                    if p_clean:
                        if p_clean not in SUPPORTED_PROVIDERS:
                            raise ValueError(
                                f"Fallback provider '{p.strip()}' is not supported. Must be one of {SUPPORTED_PROVIDERS}"
                            )
                        if p_clean not in providers:
                            providers.append(p_clean)
            return providers
        return v or []

    @field_validator("JWT_SECRET", mode="after")
    @classmethod
    def require_jwt_secret(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError(
                "Startup validation failed: JWT_SECRET is required for service-to-service auth. "
                "Set it to the same value as the Node backend's JWT_SECRET."
            )
        return v

    @model_validator(mode="after")
    def validate_and_resolve(self) -> "Settings":
        primary = self.PRIMARY_AI_PROVIDER
        fallbacks = self.FALLBACK_AI_PROVIDERS

        # 1. Conflict check: primary cannot be in fallback chain
        if primary in fallbacks:
            raise ValueError(
                f"Conflict: PRIMARY_AI_PROVIDER '{primary}' cannot also be listed in FALLBACK_AI_PROVIDERS {fallbacks}"
            )

        # 2. Validate Primary Provider Credentials (must fail startup)
        primary_key_attr = _get_key_attr(primary)
        primary_key = getattr(self, primary_key_attr, None)
        if not _is_valid_key(primary_key):
            raise ValueError(
                f"Startup validation failed: PRIMARY_AI_PROVIDER '{primary}' is configured, but its API key '{primary_key_attr}' is missing or set to a placeholder."
            )

        # 3. Filter Fallback Providers by Credentials (warn only, populate ACTIVE_FALLBACK_PROVIDERS)
        active_fallbacks = []
        for fb in fallbacks:
            fb_key_attr = _get_key_attr(fb)
            fb_key = getattr(self, fb_key_attr, None)
            if _is_valid_key(fb_key):
                active_fallbacks.append(fb)
            else:
                warning_msg = (
                    f"Fallback provider '{fb}' lacks a valid API key ({fb_key_attr}). "
                    "It will be skipped from the active fallback chain."
                )
                warnings.warn(warning_msg, RuntimeWarning)
                logger.warning(warning_msg)

        self.ACTIVE_FALLBACK_PROVIDERS = active_fallbacks

        # 4. Model Overrides & Defaults for Active Providers Only
        active_providers = [primary] + active_fallbacks
        for provider in active_providers:
            model_attr = f"{provider.upper()}_MODEL"
            model_val = getattr(self, model_attr, None)
            if not model_val or not model_val.strip():
                # Apply default model
                setattr(self, model_attr, DEFAULT_MODELS[provider])
            
            # Raise error if active provider still cannot resolve to a usable model
            resolved_model = getattr(self, model_attr, None)
            if not resolved_model or not resolved_model.strip():
                raise ValueError(
                    f"Model validation failed: Active provider '{provider}' has no resolved model."
                )

        # 5. Cross-validate adapter availability — fail fast at startup if a
        #    configured provider has no matching adapter implementation rather
        #    than letting it surface as a runtime error on the first request.
        from app.providers.registry import has_adapter
        for provider in active_providers:
            if not has_adapter(provider):
                raise ValueError(
                    f"Startup validation failed: No provider adapter implemented "
                    f"for '{provider}'. Ensure a matching adapter exists in "
                    f"app/providers/ and is registered in the provider registry."
                )

        return self

    def get_provider_key(self, provider: str) -> str:
        """
        Fetch the API key/token for a given provider, raising a descriptive
        ValueError instead of letting callers hit a raw KeyError/AttributeError
        when a key is missing, blank, or still set to its placeholder value.
        """
        if not isinstance(provider, str) or not provider.strip():
            raise ValueError("Configuration error: provider name must be a non-empty string.")

        provider_clean = provider.strip().lower()
        if provider_clean not in SUPPORTED_PROVIDERS:
            raise ValueError(
                f"Configuration error: '{provider}' is not a supported provider. "
                f"Must be one of {SUPPORTED_PROVIDERS}"
            )

        key_attr = _get_key_attr(provider_clean)
        key = getattr(self, key_attr, None)
        if not _is_valid_key(key):
            raise ValueError(
                f"Configuration error: Missing or invalid API key for provider '{provider_clean}' "
                f"(expected '{key_attr}' to be set to a real value)."
            )
        return key

# Instantiate settings
settings = Settings()

# ==============================================================================
# Module-level exports for backward compatibility
# ==============================================================================
PRIMARY_AI_PROVIDER = settings.PRIMARY_AI_PROVIDER
FALLBACK_AI_PROVIDERS = settings.FALLBACK_AI_PROVIDERS
ACTIVE_FALLBACK_PROVIDERS = settings.ACTIVE_FALLBACK_PROVIDERS

GEMINI_API_KEY = settings.GEMINI_API_KEY
GROQ_API_KEY = settings.GROQ_API_KEY
OPENAI_API_KEY = settings.OPENAI_API_KEY
ANTHROPIC_API_KEY = settings.ANTHROPIC_API_KEY
DEEPSEEK_API_KEY = settings.DEEPSEEK_API_KEY
HUGGINGFACE_TOKEN = settings.HUGGINGFACE_TOKEN

GEMINI_MODEL = settings.GEMINI_MODEL
GROQ_MODEL = settings.GROQ_MODEL
OPENAI_MODEL = settings.OPENAI_MODEL
ANTHROPIC_MODEL = settings.ANTHROPIC_MODEL
DEEPSEEK_MODEL = settings.DEEPSEEK_MODEL
HUGGINGFACE_MODEL = settings.HUGGINGFACE_MODEL

JWT_SECRET = settings.JWT_SECRET

AI_SERVICE_HOST = settings.AI_SERVICE_HOST
AI_SERVICE_PORT = settings.AI_SERVICE_PORT
DATABASE_URL = settings.DATABASE_URL
REDIS_URL = settings.REDIS_URL

AI_PROVIDER_FAILURE_LIMIT = settings.AI_PROVIDER_FAILURE_LIMIT
AI_PROVIDER_COOLDOWN_MS = settings.AI_PROVIDER_COOLDOWN_MS
