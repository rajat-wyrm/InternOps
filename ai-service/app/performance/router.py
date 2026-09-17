import logging
from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from app.performance.schemas import (
    PerformanceDataInput,
    PerformanceReviewResponse,
    PerformanceReviewJobAccepted,
    PerformanceReviewJobStatus,
)
from app.performance.analyzer import analyze_performance
from app.core.jobs import create_job, get_job, run_job, JobStatus

logger = logging.getLogger(__name__)

router = APIRouter(tags=["AI Performance Intelligence"])


async def _run_performance_analysis(job_id: str, data: PerformanceDataInput) -> None:
    await run_job(job_id, lambda: analyze_performance(data))


@router.post(
    "/ai/performance/review",
    response_model=PerformanceReviewJobAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
@router.post(
    "/performance/review",
    response_model=PerformanceReviewJobAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_performance_review(
    data: PerformanceDataInput,
    background_tasks: BackgroundTasks,
) -> PerformanceReviewJobAccepted:
    """
    Queue an evidence-backed AI performance review and recommendation plan
    for background generation.

    The AI narrative step of this review can take 10-15 seconds. Running it
    inline on this request previously left the calling Fastify backend
    blocked on a synchronous HTTP call for that whole duration, which
    triggered client-facing 504 Gateway Timeouts under load (issue #2050).
    This endpoint now enqueues the work and returns a job id immediately;
    poll `GET /ai/performance/review/{job_id}` for the completed review.
    """
    job_id = create_job()
    background_tasks.add_task(_run_performance_analysis, job_id, data)
    return PerformanceReviewJobAccepted(job_id=job_id, status=JobStatus.PENDING.value)


@router.get(
    "/ai/performance/review/{job_id}",
    response_model=None,
)
@router.get(
    "/performance/review/{job_id}",
    response_model=None,
)
async def get_performance_review(job_id: str):
    """
    Poll a queued performance review.

    Returns the job's pending/processing status until the background
    analysis finishes, at which point the full PerformanceReviewResponse
    is returned instead.
    """
    job = await get_job(job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No performance review job found with id {job_id}",
        )

    job_status = job["status"]

    if job_status == JobStatus.FAILED:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate performance review: {job.get('error')}",
        )

    if job_status == JobStatus.COMPLETED:
        result = job["result"]
        if isinstance(result, PerformanceReviewResponse):
            return result
        return PerformanceReviewResponse(**result)

    status_value = job_status.value if isinstance(job_status, JobStatus) else job_status
    return PerformanceReviewJobStatus(job_id=job_id, status=status_value)
