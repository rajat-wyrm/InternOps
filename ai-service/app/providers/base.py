from abc import ABC, abstractmethod
from typing import Dict, Any, Optional


# --- Standardized Provider Exceptions ---

class AIProviderError(Exception):
    """Base exception for all AI provider errors."""

    def __init__(self, message: str, provider_name: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.provider_name = provider_name
        self.status_code = status_code

    def __str__(self) -> str:
        suffix = f" (status={self.status_code})" if self.status_code is not None else ""
        return f"[{self.provider_name}] {self.message}{suffix}"


class ProviderAPIError(AIProviderError):
    """Raised when an upstream LLM API returns a non-200 error code."""
    pass


class ProviderRateLimitError(AIProviderError):
    """Raised when a provider rate limit (HTTP 429) or quota limit is hit."""
    pass


class ProviderTimeoutError(AIProviderError):
    """Raised when an upstream call times out."""
    pass


# --- Abstract Base Interface ---

class BaseAIProvider(ABC):
    """Abstract contract that all AI model adapters must implement."""

    def __init__(self, api_key: str, model_name: str):
        self.api_key = api_key
        self.model_name = model_name

    @property
    def provider_name(self) -> str:
        """Returns the canonical string name of the provider."""
        return self.__class__.__name__.removesuffix("Provider").lower()

    async def generate_text(self, prompt: str, temperature: float = 0.7, **kwargs) -> str:
        """Generate text output from a single prompt string."""
        return await self.generate_chat(
            [{"role": "user", "content": prompt}],
            temperature=temperature,
            **kwargs,
        )

    @abstractmethod
    async def generate_chat(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        **kwargs,
    ) -> str:
        """Generate text output from a structured conversation history."""
        pass

    @abstractmethod
    async def generate_json(
        self,
        prompt: str,
        schema: Dict[str, Any],
        temperature: float = 0.2,
        **kwargs,
    ) -> Dict[str, Any]:
        """Generate structured JSON response adhering to a target schema."""
        pass

    async def generate_image(self, prompt: str, size: str = "1024x1024", **kwargs) -> Dict[str, Any]:
        """Generate an image from a text prompt.

        Not every adapter backs a vendor with image-generation support, so the
        base implementation raises a domain error rather than being abstract.
        Providers that do support it (currently OpenAI) override this.
        """
        raise AIProviderError(
            f"Image generation is not supported by the '{self.provider_name}' provider.",
            self.provider_name,
        )