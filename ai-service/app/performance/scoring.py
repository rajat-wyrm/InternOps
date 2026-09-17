import math
from typing import Dict, Any, Tuple
from app.performance.schemas import (
    PerformanceDataInput,
    PerformanceWeights,
    DeterministicMetrics,
)


def calculate_deterministic_metrics(data: PerformanceDataInput) -> DeterministicMetrics:
    total_tasks = data.tasks_assigned
    completed = data.tasks_completed
    late = data.tasks_late
    rejected = data.tasks_rejected
    revisions = data.revisions_count
    
    completion_rate = (completed / total_tasks * 100.0) if total_tasks > 0 else 0.0
    on_time_rate = ((completed - late) / total_tasks * 100.0) if total_tasks > 0 else 0.0
    on_time_rate = max(0.0, on_time_rate)
    late_rate = (late / total_tasks * 100.0) if total_tasks > 0 else 0.0
    rejection_rate = (rejected / total_tasks * 100.0) if total_tasks > 0 else 0.0
    revision_rate = (revisions / total_tasks * 100.0) if total_tasks > 0 else 0.0
    
    avg_eval = data.avg_evaluation_score if data.avg_evaluation_score is not None else 0.0
    avg_rating = data.avg_rating_score if data.avg_rating_score is not None else 0.0
    
    # Calculate rating change & improvement trajectory
    ratings_hist = data.historical_ratings or []
    rating_change = 0.0
    if len(ratings_hist) >= 2:
        rating_change = round(ratings_hist[-1] - ratings_hist[0], 2)
    elif len(ratings_hist) == 1 and avg_rating > 0:
        rating_change = round(avg_rating - 5.0, 2)
        
    recurring_issue_rate = (len(data.recurring_issue_types) / max(1, data.issue_count)) * 100.0 if data.issue_count > 0 else 0.0
    pr_review_cycles = data.review_iterations if data.pr_count > 0 else 0.0
    ci_failure_rate = (data.ci_failures / max(1, data.pr_count)) * 100.0 if data.pr_count > 0 else 0.0
    
    # Improvement percentage from previous review if available
    prev_score = None
    if data.previous_review and isinstance(data.previous_review, dict):
        prev_score = data.previous_review.get("overall_score")
        
    improvement_pct = 0.0
    if prev_score is not None and prev_score > 0:
        # Estimated current vs previous baseline
        improvement_pct = round(((avg_eval * 10.0 - prev_score) / prev_score) * 100.0, 2)
        
    # Consistency calculation (lower variance = higher consistency score out of 100)
    consistency_score = 75.0
    if len(ratings_hist) >= 2:
        mean = sum(ratings_hist) / len(ratings_hist)
        variance = sum((x - mean) ** 2 for x in ratings_hist) / len(ratings_hist)
        stddev = math.sqrt(variance)
        consistency_score = max(0.0, min(100.0, round(100.0 - (stddev * 15.0), 2)))
        
    signal_count = (
        total_tasks + data.ratings_count + data.issue_count + data.pr_count + data.attendance_days
    )
    
    return DeterministicMetrics(
        completion_rate=round(completion_rate, 2),
        on_time_rate=round(on_time_rate, 2),
        late_rate=round(late_rate, 2),
        rejection_rate=round(rejection_rate, 2),
        revision_rate=round(revision_rate, 2),
        avg_eval_score=round(avg_eval, 2),
        avg_rating=round(avg_rating, 2),
        rating_change=round(rating_change, 2),
        recurring_issue_rate=round(recurring_issue_rate, 2),
        pr_review_cycles=round(pr_review_cycles, 2),
        ci_failure_rate=round(ci_failure_rate, 2),
        improvement_pct=round(improvement_pct, 2),
        consistency_score=round(consistency_score, 2),
        signal_count=signal_count,
    )


def compute_dimension_scores(
    data: PerformanceDataInput, metrics: DeterministicMetrics
) -> Dict[str, float]:
    """
    Computes scores (0 to 100) for each of the 9 performance dimensions.
    """
    # 1. Task Execution (20%)
    if data.tasks_assigned > 0:
        task_exec = (metrics.completion_rate * 0.7) + (min(100.0, data.tasks_completed * 10.0) * 0.3)
    else:
        task_exec = 50.0
        
    # 2. Task Quality (15%)
    if metrics.avg_eval_score > 0:
        task_qual = (metrics.avg_eval_score / 10.0 * 100.0) * 0.8 + ((100.0 - metrics.rejection_rate) * 0.2)
    else:
        task_qual = 50.0
        
    # 3. Timeliness (10%)
    if data.tasks_assigned > 0:
        timeliness = metrics.on_time_rate
    else:
        timeliness = 50.0
        
    # 4. Technical Quality (15%)
    eval_part = (metrics.avg_eval_score / 10.0 * 100.0) if metrics.avg_eval_score > 0 else 50.0
    issue_penalty = min(40.0, data.issue_count * 8.0)
    tech_qual = max(0.0, min(100.0, eval_part - issue_penalty))
    
    # 5. Code Quality (15%)
    if data.pr_count > 0:
        pr_merge_rate = (data.merged_prs / data.pr_count) * 100.0
        cycle_penalty = min(30.0, (data.review_iterations - 1.0) * 15.0) if data.review_iterations > 1 else 0.0
        ci_penalty = min(30.0, metrics.ci_failure_rate * 0.5)
        code_qual = max(0.0, min(100.0, pr_merge_rate - cycle_penalty - ci_penalty))
    else:
        # Default aligned with task quality when PR data not present
        code_qual = task_qual
        
    # 6. Feedback Responsiveness (10%)
    if data.tasks_rejected > 0 or data.revisions_count > 0:
        revision_resilience = max(0.0, 100.0 - (data.revisions_count * 15.0))
        feedback_resp = (revision_resilience * 0.6) + (metrics.completion_rate * 0.4)
    else:
        feedback_resp = 85.0
        
    # 7. Reliability (5%)
    late_penalty = metrics.late_rate * 0.6
    absent_penalty = min(40.0, data.absent_days * 15.0)
    reliability = max(0.0, min(100.0, 100.0 - late_penalty - absent_penalty))
    
    # 8. Consistency (5%)
    consistency = metrics.consistency_score
    
    # 9. Improvement Trajectory (5%)
    base_traj = 50.0
    if metrics.rating_change > 0:
        base_traj += min(40.0, metrics.rating_change * 15.0)
    elif metrics.rating_change < 0:
        base_traj -= min(40.0, abs(metrics.rating_change) * 15.0)
        
    if metrics.improvement_pct > 0:
        base_traj += min(10.0, metrics.improvement_pct)
    trajectory = max(0.0, min(100.0, base_traj))
    
    return {
        "task_execution": round(task_exec, 1),
        "task_quality": round(task_qual, 1),
        "timeliness": round(timeliness, 1),
        "technical_quality": round(tech_qual, 1),
        "code_quality": round(code_qual, 1),
        "feedback_responsiveness": round(feedback_resp, 1),
        "reliability": round(reliability, 1),
        "consistency": round(consistency, 1),
        "improvement_trajectory": round(trajectory, 1),
    }


def calculate_overall_performance(
    data: PerformanceDataInput,
) -> Tuple[float, str, float, Dict[str, float], DeterministicMetrics, str]:
    """
    Calculates overall weighted score, performance level, confidence, and status.
    """
    metrics = calculate_deterministic_metrics(data)
    
    # Check for insufficient data
    if metrics.signal_count < 2 and data.tasks_assigned == 0 and data.ratings_count == 0:
        return (
            0.0,
            "Insufficient Data",
            0.30,
            {
                "task_execution": 0.0,
                "task_quality": 0.0,
                "timeliness": 0.0,
                "technical_quality": 0.0,
                "code_quality": 0.0,
                "feedback_responsiveness": 0.0,
                "reliability": 0.0,
                "consistency": 0.0,
                "improvement_trajectory": 0.0,
            },
            metrics,
            "insufficient_data",
        )
        
    w = data.custom_weights or PerformanceWeights()
    dim_scores = compute_dimension_scores(data, metrics)
    
    overall = (
        dim_scores["task_execution"] * w.task_execution
        + dim_scores["task_quality"] * w.task_quality
        + dim_scores["timeliness"] * w.timeliness
        + dim_scores["technical_quality"] * w.technical_quality
        + dim_scores["code_quality"] * w.code_quality
        + dim_scores["feedback_responsiveness"] * w.feedback_responsiveness
        + dim_scores["reliability"] * w.reliability
        + dim_scores["consistency"] * w.consistency
        + dim_scores["improvement_trajectory"] * w.improvement_trajectory
    )
    overall = round(max(0.0, min(100.0, overall)), 1)
    
    # Level mapping
    if overall >= 88.0:
        level = "Exceptional"
    elif overall >= 75.0:
        level = "Good"
    elif overall >= 60.0:
        level = "Satisfactory"
    elif overall >= 45.0:
        level = "Needs Improvement"
    else:
        level = "At Risk"
        
    # Confidence score based on signal count
    confidence = min(0.95, 0.50 + (metrics.signal_count * 0.05))
    confidence = round(confidence, 2)
    
    return overall, level, confidence, dim_scores, metrics, "completed"
