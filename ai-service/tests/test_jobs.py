"""
Tests for app/core/jobs.py — the in-process background job manager used
to keep long-running AI work off the request/response path (issue #2050).
"""

import asyncio

import pytest

from app.core import jobs as jobs_module
from app.core.jobs import JobStatus, clear_jobs, create_job, get_job, run_job


@pytest.fixture(autouse=True)
def _reset_jobs():
    clear_jobs()
    yield
    clear_jobs()


@pytest.mark.asyncio
async def test_create_job_starts_pending():
    job_id = create_job()
    job = await get_job(job_id)

    assert job is not None
    assert job["status"] == JobStatus.PENDING
    assert job["result"] is None
    assert job["error"] is None


@pytest.mark.asyncio
async def test_get_job_unknown_returns_none():
    assert await get_job("does-not-exist") is None


@pytest.mark.asyncio
async def test_run_job_records_successful_result():
    job_id = create_job()

    async def compute():
        return {"value": 42}

    await run_job(job_id, compute)

    job = await get_job(job_id)
    assert job["status"] == JobStatus.COMPLETED
    assert job["result"] == {"value": 42}
    assert job["error"] is None


@pytest.mark.asyncio
async def test_run_job_records_failure():
    job_id = create_job()

    async def compute():
        raise ValueError("boom")

    await run_job(job_id, compute)

    job = await get_job(job_id)
    assert job["status"] == JobStatus.FAILED
    assert job["result"] is None
    assert "boom" in job["error"]


@pytest.mark.asyncio
async def test_run_job_does_not_block_caller():
    """
    The whole point of the job manager: scheduling work must let the
    caller move on immediately instead of waiting for it to finish, unlike
    the previous synchronous /ai/performance/review implementation that
    blocked the calling Fastify backend for the full AI latency.
    """
    job_id = create_job()
    started = asyncio.Event()
    finish = asyncio.Event()

    async def slow_compute():
        started.set()
        await finish.wait()
        return "done"

    task = asyncio.create_task(run_job(job_id, slow_compute))

    # Give the background task a chance to start, but don't let it finish.
    await asyncio.wait_for(started.wait(), timeout=1)
    job = await get_job(job_id)
    assert job["status"] == JobStatus.PROCESSING

    # Now let it complete and confirm the final state is recorded.
    finish.set()
    await asyncio.wait_for(task, timeout=1)

    job = await get_job(job_id)
    assert job["status"] == JobStatus.COMPLETED
    assert job["result"] == "done"


@pytest.mark.asyncio
async def test_run_job_unknown_job_is_a_noop():
    # Should not raise even though "missing" was never created.
    await run_job("missing", lambda: asyncio.sleep(0))
    assert await get_job("missing") is None


def test_create_job_prunes_expired_entries(monkeypatch):
    old_job_id = create_job()
    jobs_module._jobs[old_job_id]["created_at"] -= jobs_module.JOB_TTL_SECONDS + 1

    new_job_id = create_job()

    assert old_job_id not in jobs_module._jobs
    assert new_job_id in jobs_module._jobs
