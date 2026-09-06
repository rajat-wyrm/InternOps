import logging
from fastapi import APIRouter, HTTPException, status
from app.performance.schemas import (
    PerformanceDataInput,
    PerformanceReviewResponse,
)
from app.performance.analyzer import analyze_performance

logger = logging.getLogger(__name__)

router = APIRouter(tags=["AI Performance Intelligence"])


@router.post(
    "/ai/performance/review",
    response_model=PerformanceReviewResponse,
    status_code=status.HTTP_200_OK,
)
@router.post(
    "/performance/review",
    response_model=PerformanceReviewResponse,
    status_code=status.HTTP_200_OK,
)
async def generate_performance_review(
    data: PerformanceDataInput,
) -> PerformanceReviewResponse:
    """
    Generate an evidence-backed AI performance review and recommendation plan
    from deterministic metrics and intern work performance signals.
    """
    try:
        review = await analyze_performance(data)
        return review
    except Exception as e:
        logger.error(f"Performance review analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate performance review: {str(e)}",
        )
