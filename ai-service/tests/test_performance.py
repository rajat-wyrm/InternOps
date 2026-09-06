import pytest
from app.performance.schemas import PerformanceDataInput
from app.performance.scoring import calculate_deterministic_metrics, calculate_overall_performance
from app.performance.analyzer import analyze_performance


def test_deterministic_scoring_high_performer():
    data = PerformanceDataInput(
        intern_id="user-123",
        intern_name="Alice Performer",
        review_period_start="2026-08-01",
        review_period_end="2026-08-31",
        tasks_assigned=10,
        tasks_completed=10,
        tasks_late=0,
        tasks_rejected=0,
        avg_evaluation_score=9.2,
        ratings_count=4,
        avg_rating_score=9.0,
        historical_ratings=[8.5, 8.8, 9.0, 9.2],
        pr_count=5,
        merged_prs=5,
        review_iterations=1.2,
    )
    
    metrics = calculate_deterministic_metrics(data)
    assert metrics.completion_rate == 100.0
    assert metrics.on_time_rate == 100.0
    assert metrics.rejection_rate == 0.0
    
    score, level, confidence, dims, metrics, status = calculate_overall_performance(data)
    assert status == "completed"
    assert score >= 85.0
    assert level in ["Exceptional", "Good"]
    assert confidence > 0.6


def test_deterministic_scoring_insufficient_data():
    data = PerformanceDataInput(
        intern_id="user-456",
        intern_name="New Intern",
        review_period_start="2026-08-01",
        review_period_end="2026-08-31",
        tasks_assigned=0,
        tasks_completed=0,
        ratings_count=0,
    )
    
    score, level, confidence, dims, metrics, status = calculate_overall_performance(data)
    assert status == "insufficient_data"
    assert level == "Insufficient Data"
    assert score == 0.0


@pytest.mark.asyncio
async def test_analyze_performance_declining_performer():
    data = PerformanceDataInput(
        intern_id="user-789",
        intern_name="Charlie Struggling",
        review_period_start="2026-08-01",
        review_period_end="2026-08-31",
        tasks_assigned=10,
        tasks_completed=6,
        tasks_late=4,
        tasks_rejected=3,
        revisions_count=4,
        avg_evaluation_score=5.5,
        ratings_count=3,
        avg_rating_score=5.0,
        historical_ratings=[7.0, 6.0, 5.0],
        recurring_issue_types=["Incomplete validation", "Missing error handling"],
        rejection_reasons=["Missing validation", "Unchecked boundary condition"],
        previous_review={"overall_score": 72.0},
    )
    
    review = await analyze_performance(data)
    assert review.status == "completed"
    assert review.early_warning.state in ["Needs Attention", "At Risk"]
    assert len(review.strengths) >= 1
    assert len(review.development_areas) >= 1
    assert len(review.recommendations) >= 1
    assert len(review.recurring_issues) >= 1
    assert review.performance_trend.direction == "declining"
