"""Base abstraction for LLM provider adapters.

Defines the interface every concrete provider (Gemini, OpenAI, ...) must
implement, plus the standardized exception hierarchy used to map
vendor-specific HTTP/SDK errors onto a common shape the rest of ai-service
can handle without knowing which vendor is behind a given call.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional


class AIProviderError(Exception):
    """Base class for all provider-related errors."""

    def __init__(self, message: str, provider_name: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.provider_name = provider_name
        self.status_code = status_code

    def __str__(self) -> str:
        suffix = f" (status={self.status_code})" if self.status_code is not None else ""
        return f"[{self.provider_name}] {self.message}{suffix}"


class ProviderAPIError(AIProviderError):
    """Generic non-2xx response, malformed payload, or network error."""


class ProviderRateLimitError(AIProviderError):
    """Vendor returned HTTP 429 (rate limit or quota exceeded)."""


class ProviderTimeoutError(AIProviderError):
    """Request exceeded the configured timeout, or the connection timed out."""


class BaseAIProvider(ABC):
    """Abstract interface every concrete LLM provider adapter must implement."""

    #: Override in subclasses if the desired name differs from the
    #: lowercased class name minus a trailing "Provider" (e.g. "gemini").
    provider_name: str = ""

    def __init__(self, api_key: str, model_name: str):
        self.api_key = api_key
        self.model_name = model_name
        if not self.provider_name:
            self.provider_name = self.__class__.__name__.removesuffix("Provider").lower()

    @abstractmethod
    async def generate_text(self, prompt: str, temperature: float = 0.7, **kwargs) -> str:
        """Return a plain-text completion for the given prompt."""
        raise NotImplementedError

    @abstractmethod
    async def generate_json(
        self, prompt: str, schema: Dict[str, Any], temperature: float = 0.2, **kwargs
    ) -> Dict[str, Any]:
        """Return a parsed dict matching `schema` for the given prompt."""
        raise NotImplementedError
