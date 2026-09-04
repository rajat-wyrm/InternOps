"""
Assignment topic visual generation.

Given a text description of an assignment/task topic, generates a relevant
image via an AI image-generation provider so it can be shown and attached
during assignment creation/editing (issue #1801).

Two things this module owns beyond "call the provider":

1. Duplicate-request prevention: while a generation for a given
   (user, topic) pair is already in flight, a second call raises
   DuplicateGenerationError instead of firing a second vendor request. This
   is backed by Redis when available, with an in-memory fallback so the
   guard still works in tests / single-process deployments without Redis.

2. Graceful failure: provider/vendor errors are left to bubble up as
   AIProviderError subclasses so callers (the API layer) can decide how to
   respond, but they never leave the in-flight lock held.
"""

import hashlib
import logging
from typing import Dict

from app.core.redis_client import get_redis
from app.core.security import sanitize_prompt
from app.providers.base import AIProviderError
from app.providers.registry import get_provider

logger = logging.getLogger(__name__)

# Image-generation is only backed by OpenAI's Images API today.
IMAGE_PROVIDER_NAME = "openai"

# How long an in-flight lock is held before it's considered stale and
# released automatically (covers a crashed/hung request).
LOCK_TTL_SECONDS = 60


class DuplicateGenerationError(Exception):
    """Raised when a visual is already being generated for this topic."""

    def __init__(self, message: str = "Image generation already in progress for this topic."):
        super().__init__(message)
        self.message = message


# In-memory fallback lock set, used only when Redis is unavailable.
_in_memory_locks: set[str] = set()


def _lock_key(user_id: str, topic: str) -> str:
    topic_hash = hashlib.sha256(topic.strip().lower().encode("utf-8")).hexdigest()
    return f"assignment_visual:lock:{user_id}:{topic_hash}"


async def _acquire_lock(key: str) -> bool:
    redis = get_redis()
    if redis:
        try:
            # NX: only set if not already present -> atomic dedup check.
            acquired = await redis.set(key, "1", ex=LOCK_TTL_SECONDS, nx=True)
            return bool(acquired)
        except Exception as e:
            logger.warning("Redis lock acquisition failed for '%s': %s. Falling back to in-memory.", key, e)

    if key in _in_memory_locks:
        return False
    _in_memory_locks.add(key)
    return True


async def _release_lock(key: str) -> None:
    redis = get_redis()
    if redis:
        try:
            await redis.delete(key)
            return
        except Exception as e:
            logger.warning("Redis lock release failed for '%s': %s", key, e)
    _in_memory_locks.discard(key)


async def generate_assignment_visual(topic: str, user_id: str) -> Dict[str, str]:
    """
    Generate an image for the given assignment topic/description.

    Raises:
        ValueError: topic is empty, too long, or otherwise invalid input.
        DuplicateGenerationError: a request for this (user, topic) is already
            in flight.
        AIProviderError (or subclass): the image-generation provider failed;
            existing assignment creation should continue without a visual.
    """
    clean_topic = sanitize_prompt(topic)

    key = _lock_key(user_id, clean_topic)
    if not await _acquire_lock(key):
        raise DuplicateGenerationError()

    try:
        provider = get_provider(IMAGE_PROVIDER_NAME)
        result = await provider.generate_image(clean_topic)
        if not result or not result.get("url"):
            raise AIProviderError(
                "Image generation provider returned no image.", IMAGE_PROVIDER_NAME
            )
        return {
            "image_url": result["url"],
            "provider": provider.provider_name,
            "topic": clean_topic,
        }
    finally:
        await _release_lock(key)
