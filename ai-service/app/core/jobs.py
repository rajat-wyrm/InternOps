"""
Lightweight in-process background job manager.

Long-running AI operations (e.g. full performance review generation, which
can take 10-15 seconds while waiting on an LLM completion) must not be
executed synchronously inside a request handler: the calling Fastify
backend makes a plain synchronous HTTP request and will time out the
client-facing browser request with a 504 Gateway Timeout while it waits
(see issue #2050).

This module gives request handlers a way to hand off that work to a
background task and return immediately with a job id, while callers poll
for the result. Job state lives in an in-process dict (so a single worker
process can service polling requests without any extra infrastructure)
and is mirrored to Redis when available so job status survives across
worker restarts and can be looked up by other processes sharing the same
Redis instance. This mirrors the fallback/Redis pattern already used by
app.core.cache.
"""

import json
import logging
import time
import uuid
from enum import Enum
from typing import Any, Awaitable, Callable, Dict, Optional

from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)

# How long a completed/failed job's state is retained before it is treated
# as expired (and pruned from the in-memory store / left to expire in Redis).
JOB_TTL_SECONDS = 3600

_JOB_KEY_PREFIX = "ai:job:"

# job_id -> {"status": JobStatus, "result": Any, "error": str | None, "created_at": float}
_jobs: Dict[str, Dict[str, Any]] = {}


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


def _redis_key(job_id: str) -> str:
    return f"{_JOB_KEY_PREFIX}{job_id}"


def _prune_expired() -> None:
    now = time.time()
    expired = [
        job_id
        for job_id, job in _jobs.items()
        if now - job["created_at"] > JOB_TTL_SECONDS
    ]
    for job_id in expired:
        _jobs.pop(job_id, None)


def create_job() -> str:
    """Register a new pending job and return its id."""
    _prune_expired()
    job_id = uuid.uuid4().hex
    _jobs[job_id] = {
        "status": JobStatus.PENDING,
        "result": None,
        "error": None,
        "created_at": time.time(),
    }
    return job_id


async def _persist(job_id: str) -> None:
    """Best-effort mirror of a job's state into Redis, if configured."""
    redis = get_redis()
    if redis is None:
        return

    job = _jobs.get(job_id)
    if job is None:
        return

    try:
        serializable_result = None
        if job["result"] is not None:
            if hasattr(job["result"], "model_dump"):
                serializable_result = job["result"].model_dump(mode="json")
            elif hasattr(job["result"], "dict"):
                serializable_result = job["result"].dict()
            else:
                serializable_result = job["result"]

        payload = {
            "status": job["status"].value if isinstance(job["status"], JobStatus) else job["status"],
            "result": serializable_result,
            "error": job["error"],
        }
        await redis.set(_redis_key(job_id), json.dumps(payload), ex=JOB_TTL_SECONDS)
    except Exception as exc:
        logger.warning("Failed to persist job %s to Redis: %s", job_id, exc)


async def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    """
    Look up a job's current state.

    Checks the in-process store first (authoritative for jobs started by
    this worker), falling back to Redis so status can still be polled if
    the store was cleared (e.g. after a restart) but another process
    already persisted the result.
    """
    job = _jobs.get(job_id)
    if job is not None:
        return job

    redis = get_redis()
    if redis is None:
        return None

    try:
        raw = await redis.get(_redis_key(job_id))
        if raw is None:
            return None
        payload = json.loads(raw)
        return {
            "status": JobStatus(payload["status"]),
            "result": payload.get("result"),
            "error": payload.get("error"),
        }
    except Exception as exc:
        logger.warning("Failed to fetch job %s from Redis: %s", job_id, exc)
        return None


async def run_job(job_id: str, compute: Callable[[], Awaitable[Any]]) -> None:
    """
    Execute `compute` for a previously-created job, recording its outcome.

    Intended to be scheduled via FastAPI's BackgroundTasks (or
    asyncio.create_task) so the HTTP request that created the job can
    return immediately instead of blocking on `compute`.
    """
    if job_id not in _jobs:
        # Job was pruned or never created in this process; nothing to update.
        logger.warning("run_job called for unknown job %s", job_id)
        return

    _jobs[job_id]["status"] = JobStatus.PROCESSING
    await _persist(job_id)

    try:
        result = await compute()
        _jobs[job_id]["status"] = JobStatus.COMPLETED
        _jobs[job_id]["result"] = result
    except Exception as exc:
        logger.error("Background job %s failed: %s", job_id, exc, exc_info=True)
        _jobs[job_id]["status"] = JobStatus.FAILED
        _jobs[job_id]["error"] = str(exc)

    await _persist(job_id)


def clear_jobs() -> None:
    """Clear all in-memory job state. Primarily useful for tests."""
    _jobs.clear()
