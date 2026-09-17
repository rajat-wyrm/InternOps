"""
Backward compatibility module aliasing app.core.rate_limiter.
"""

from app.core.rate_limiter import RateLimiter, ai_rate_limiter, chat_rate_limiter

__all__ = ["RateLimiter", "ai_rate_limiter", "chat_rate_limiter"]
