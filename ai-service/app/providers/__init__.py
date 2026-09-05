from app.providers.base import (
    BaseAIProvider,
    AIProviderError,
    ProviderAPIError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)

from app.providers.gemini import GeminiProvider
from app.providers.openai import OpenAIProvider
from app.providers.groq import GroqProvider
from app.providers.anthropic import AnthropicProvider
from app.providers.deepseek import DeepSeekProvider
from app.providers.huggingface import HuggingFaceProvider
from app.providers.nvidia import NvidiaProvider


def __getattr__(name: str):
    if name in ("AIOrchestrator", "ai_orchestrator"):
        from app.providers.orchestrator import AIOrchestrator, ai_orchestrator
        return AIOrchestrator if name == "AIOrchestrator" else ai_orchestrator
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")


__all__ = [
    "BaseAIProvider",
    "AIProviderError",
    "ProviderAPIError",
    "ProviderRateLimitError",
    "ProviderTimeoutError",
    "GeminiProvider",
    "OpenAIProvider",
    "GroqProvider",
    "AnthropicProvider",
    "DeepSeekProvider",
    "HuggingFaceProvider",
    "NvidiaProvider",
    "AIOrchestrator",
    "ai_orchestrator",
]