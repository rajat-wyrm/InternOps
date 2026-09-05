from typing import List, Dict, Any
from app.performance.schemas import (
    PerformanceDataInput,
    DeterministicMetrics,
    EarlyWarning,
    StrengthItem,
    DevelopmentAreaItem,
    RecurringIssueItem,
    PerformanceTrend,
)


def detect_early_warnings(
    data: PerformanceDataInput,
    metrics: DeterministicMetrics,
    overall_score: float,
    status: str,
) -> EarlyWarning:
    if status == "insufficient_data":
        return EarlyWarning(
            state="Insufficient Data",
            triggers=["Minimal or no performance records found in current period"],
            evidence=["0 tasks assigned or rated"],
        )
        
    triggers = []
    evidence = []
    
    if metrics.late_rate >= 30.0:
        triggers.append("Increasing late task submissions")
        evidence.append(f"Late submission rate is {metrics.late_rate}% ({data.tasks_late} tasks late)")
        
    if metrics.rejection_rate >= 25.0:
        triggers.append("Elevated task rejection rate")
        evidence.append(f"Rejection rate reached {metrics.rejection_rate}%")
        
    if metrics.rating_change <= -1.5:
        triggers.append("Declining rating trend")
        evidence.append(f"Rating dropped by {abs(metrics.rating_change)} points")
        
    if data.revisions_count >= 3:
        triggers.append("High revision iteration count")
        evidence.append(f"{data.revisions_count} task revisions required")
        
    if metrics.ci_failure_rate >= 40.0:
        triggers.append("High CI build failure rate")
        evidence.append(f"CI failed on {metrics.ci_failure_rate}% of PR runs")
        
    if len(data.recurring_issue_types) >= 2:
        triggers.append("Multiple recurring feedback patterns")
        evidence.append(f"Recurring issues: {', '.join(data.recurring_issue_types)}")
        
    if overall_score < 50.0 or len(triggers) >= 3:
        state = "At Risk"
    elif overall_score < 70.0 or len(triggers) >= 1:
        state = "Needs Attention"
    else:
        state = "Healthy"
        
    return EarlyWarning(state=state, triggers=triggers, evidence=evidence)


def extract_strengths(
    data: PerformanceDataInput,
    metrics: DeterministicMetrics,
    dim_scores: Dict[str, float],
) -> List[StrengthItem]:
    strengths = []
    
    if dim_scores.get("task_quality", 0) >= 75.0 and metrics.avg_eval_score > 0:
        strengths.append(
            StrengthItem(
                area="Task Quality",
                evidence=[
                    f"Average evaluation score: {metrics.avg_eval_score}/10",
                    f"Task rejection rate: {metrics.rejection_rate}%",
                ],
                impact="Tasks consistently meet high quality standards with minimal rework.",
            )
        )
        
    if dim_scores.get("timeliness", 0) >= 80.0 and data.tasks_completed > 0:
        strengths.append(
            StrengthItem(
                area="Timeliness & Execution",
                evidence=[
                    f"On-time completion rate: {metrics.on_time_rate}%",
                    f"{data.tasks_completed} of {data.tasks_assigned} tasks completed on schedule",
                ],
                impact="Demonstrates strong time management and reliable project delivery.",
            )
        )
        
    if dim_scores.get("consistency", 0) >= 80.0:
        strengths.append(
            StrengthItem(
                area="Performance Consistency",
                evidence=[
                    f"Consistency score: {metrics.consistency_score}/100",
                    f"Rating stability across evaluations",
                ],
                impact="Maintains high standard of work without unpredictable output fluctuations.",
            )
        )
        
    if metrics.rating_change > 0:
        strengths.append(
            StrengthItem(
                area="Positive Growth Trajectory",
                evidence=[
                    f"Rating score improved by +{metrics.rating_change} points across review periods",
                ],
                impact="Actively incorporates past feedback to drive continuous self-improvement.",
            )
        )
        
    if not strengths:
        strengths.append(
            StrengthItem(
                area="Basic Task Execution",
                evidence=[f"Completed {data.tasks_completed} tasks in period"],
                impact="Fulfills core task assignments.",
            )
        )
        
    return strengths[:4]


def extract_development_areas(
    data: PerformanceDataInput,
    metrics: DeterministicMetrics,
    dim_scores: Dict[str, float],
) -> List[DevelopmentAreaItem]:
    areas = []
    
    if metrics.late_rate > 15.0 or dim_scores.get("timeliness", 100) < 70.0:
        areas.append(
            DevelopmentAreaItem(
                area="Timeliness & Deadline Estimation",
                severity="high" if metrics.late_rate >= 35.0 else "medium",
                evidence=[
                    f"{data.tasks_late} of {data.tasks_assigned} tasks completed past deadline ({metrics.late_rate}% late rate)",
                ],
                recommendation="Improve initial task estimation and break large deliverables into manageable daily milestones.",
            )
        )
        
    if metrics.rejection_rate > 15.0 or data.revisions_count >= 2:
        areas.append(
            DevelopmentAreaItem(
                area="Validation & Rework Prevention",
                severity="high" if metrics.rejection_rate >= 30.0 else "medium",
                evidence=[
                    f"Task rejection rate of {metrics.rejection_rate}% with {data.revisions_count} total revisions",
                    *data.rejection_reasons[:2],
                ],
                recommendation="Perform structured self-checks and verification before submitting completed deliverables.",
            )
        )
        
    if data.pr_count > 0 and (data.review_iterations > 2.0 or metrics.ci_failure_rate > 25.0):
        areas.append(
            DevelopmentAreaItem(
                area="Code Review & CI Cleanliness",
                severity="medium",
                evidence=[
                    f"Average PR review iterations: {data.review_iterations}",
                    f"CI failure rate: {metrics.ci_failure_rate}%",
                ],
                recommendation="Run local test suite and lint checks prior to requesting code review.",
            )
        )
        
    if not areas and dim_scores.get("overall", 100) < 90.0:
        areas.append(
            DevelopmentAreaItem(
                area="Technical Depth & Autonomy",
                severity="low",
                evidence=["Opportunities exist to tackle higher complexity tasks independently."],
                recommendation="Seek out challenging technical tasks to deepen core system knowledge.",
            )
        )
        
    return areas[:4]


def extract_recurring_issues(data: PerformanceDataInput) -> List[RecurringIssueItem]:
    recurring = []
    
    # Check issue types & feedback comments
    issue_counts: Dict[str, int] = {}
    for item in data.recurring_issue_types + data.rejection_reasons + data.rating_comments:
        key = item.strip().title()
        if key:
            issue_counts[key] = issue_counts.get(key, 0) + 1
            
    for issue_title, freq in issue_counts.items():
        if freq >= 2 or len(issue_counts) == 1:
            recurring.append(
                RecurringIssueItem(
                    issue=issue_title,
                    frequency=freq,
                    evidence=[
                        f"Detected in {freq} separate review comments / evaluation notes",
                    ],
                )
            )
            
    if not recurring and data.tasks_rejected > 0:
        recurring.append(
            RecurringIssueItem(
                issue="Task Submission Quality",
                frequency=data.tasks_rejected,
                evidence=[f"{data.tasks_rejected} task submissions required evaluator re-submission"],
            )
        )
        
    return recurring[:5]


def calculate_performance_trend(
    data: PerformanceDataInput, overall_score: float, status: str
) -> PerformanceTrend:
    if status == "insufficient_data":
        return PerformanceTrend(
            direction="insufficient_data",
            previous_score=None,
            current_score=overall_score,
            change=0.0,
        )
        
    prev_score = None
    if data.previous_review and isinstance(data.previous_review, dict):
        prev_score = data.previous_review.get("overall_score")
        
    if prev_score is None or prev_score <= 0:
        return PerformanceTrend(
            direction="stable",
            previous_score=None,
            current_score=overall_score,
            change=0.0,
        )
        
    change = round(overall_score - float(prev_score), 1)
    if change >= 4.0:
        direction = "improving"
    elif change <= -4.0:
        direction = "declining"
    else:
        direction = "stable"
        
    return PerformanceTrend(
        direction=direction,
        previous_score=float(prev_score),
        current_score=overall_score,
        change=change,
    )
