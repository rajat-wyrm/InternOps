"""
Tests for app/performance/router.py — verifies performance reviews are
queued as background jobs instead of generated inline on the request
(issue #2050: the previous synchronous implementation could take 10-15s
and left the calling Fastify backend blocked, causing client-facing 504
Gateway Timeouts).
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.jobs import clear_jobs
from app.performance.router import router
from app.performance.schemas import PerformanceReviewResponse


@pytest.fixture(autouse=True)
def _reset_jobs():
    clear_jobs()
    yield
    clear_jobs()


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app, raise_server_exceptions=False)


HIGH_PERFORMER_PAYLOAD = {
    "intern_id": "user-123",
    "intern_name": "Alice Performer",
    "review_period_start": "2026-08-01",
    "review_period_end": "2026-08-31",
    "tasks_assigned": 10,
    "tasks_completed": 10,
    "tasks_late": 0,
    "tasks_rejected": 0,
    "avg_evaluation_score": 9.2,
    "ratings_count": 4,
    "avg_rating_score": 9.0,
    "historical_ratings": [8.5, 8.8, 9.0, 9.2],
    "pr_count": 5,
    "merged_prs": 5,
    "review_iterations": 1.2,
}

INSUFFICIENT_DATA_PAYLOAD = {
    "intern_id": "user-456",
    "intern_name": "New Intern",
    "review_period_start": "2026-08-01",
    "review_period_end": "2026-08-31",
    "tasks_assigned": 0,
    "tasks_completed": 0,
    "ratings_count": 0,
}


def test_post_review_returns_202_with_job_id_immediately(client):
    r = client.post("/ai/performance/review", json=HIGH_PERFORMER_PAYLOAD)

    assert r.status_code == 202
    body = r.json()
    assert "job_id" in body and body["job_id"]
    assert body["status"] == "pending"


def test_post_review_alias_path_also_returns_202(client):
    r = client.post("/performance/review", json=HIGH_PERFORMER_PAYLOAD)
    assert r.status_code == 202
    assert "job_id" in r.json()


def test_poll_completed_job_returns_full_review(client):
    post_resp = client.post("/ai/performance/review", json=HIGH_PERFORMER_PAYLOAD)
    job_id = post_resp.json()["job_id"]

    # TestClient drives the ASGI app (including the queued BackgroundTasks
    # callback) to completion before returning control here, so the job is
    # already finished by this point.
    status_resp = client.get(f"/ai/performance/review/{job_id}")

    assert status_resp.status_code == 200
    body = status_resp.json()
    assert body["status"] == "completed"
    # Validates the payload is a full PerformanceReviewResponse, not just
    # a bare status marker.
    parsed = PerformanceReviewResponse(**body)
    assert parsed.performance_level in ["Exceptional", "Good"]
    assert parsed.overall_score >= 85.0


def test_poll_completed_job_via_alias_path(client):
    post_resp = client.post("/performance/review", json=INSUFFICIENT_DATA_PAYLOAD)
    job_id = post_resp.json()["job_id"]

    status_resp = client.get(f"/performance/review/{job_id}")

    assert status_resp.status_code == 200
    body = status_resp.json()
    assert body["status"] == "insufficient_data"
    assert body["performance_level"] == "Insufficient Data"


def test_poll_unknown_job_returns_404(client):
    r = client.get("/ai/performance/review/does-not-exist")
    assert r.status_code == 404


def test_post_review_validation_error_returns_422(client):
    r = client.post("/ai/performance/review", json={"intern_id": "user-1"})
    assert r.status_code == 422
