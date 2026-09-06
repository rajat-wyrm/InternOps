from typing import List
from app.performance.schemas import (
    PerformanceDataInput,
    DeterministicMetrics,
    DevelopmentAreaItem,
    RecurringIssueItem,
    RecommendationItem,
    LearningPlanItem,
)


def generate_recommendations(
    data: PerformanceDataInput,
    metrics: DeterministicMetrics,
    dev_areas: List[DevelopmentAreaItem],
    recurring_issues: List[RecurringIssueItem],
) -> List[RecommendationItem]:
    recommendations = []
    
    # 1. Timeliness & Deadline Management
    if metrics.late_rate > 15.0 or data.tasks_late > 0:
        recommendations.append(
            RecommendationItem(
                priority="high" if metrics.late_rate >= 30.0 else "medium",
                title="Improve Task Estimation & Milestone Tracking",
                description="Decompose complex multi-day tasks into sub-tasks with daily completion checkpoints.",
                reason=f"Detected {data.tasks_late} late task submissions ({metrics.late_rate}% late rate).",
                expected_outcome="Reduce late task submissions by >50% in the next review period.",
                timeframe="2 weeks",
            )
        )
        
    # 2. Quality & Validation Checklist
    if metrics.rejection_rate > 10.0 or data.revisions_count > 0:
        recommendations.append(
            RecommendationItem(
                priority="high" if metrics.rejection_rate >= 25.0 else "medium",
                title="Strengthen Pre-Submission Verification",
                description="Apply a self-review checklist covering functional testing, edge cases, and documentation before submitting tasks.",
                reason=f"Task rejection rate is {metrics.rejection_rate}% with {data.revisions_count} revision requests.",
                expected_outcome="Achieve zero task rejections and lower revision count.",
                timeframe="1 to 2 weeks",
            )
        )
        
    # 3. Recurring issues addressal
    for rec_issue in recurring_issues:
        recommendations.append(
            RecommendationItem(
                priority="high",
                title=f"Address Recurring Feedback: {rec_issue.issue}",
                description=f"Focus on resolving repeated issue '{rec_issue.issue}' through dedicated practice and peer review.",
                reason=f"Recurring issue flagged {rec_issue.frequency} times across task evaluations.",
                expected_outcome=f"Eliminate repeated comments regarding {rec_issue.issue}.",
                timeframe="2 weeks",
            )
        )
        
    # 4. Code Review & PR Quality
    if data.pr_count > 0 and (data.review_iterations > 2.0 or metrics.ci_failure_rate > 20.0):
        recommendations.append(
            RecommendationItem(
                priority="medium",
                title="Optimize PR Review Efficiency",
                description="Ensure automated CI checks pass locally and perform self-code review prior to requesting reviewer assignment.",
                reason=f"Average PR review iterations reached {data.review_iterations} with {metrics.ci_failure_rate}% CI failure rate.",
                expected_outcome="Decrease average review iterations to < 2.0 cycles.",
                timeframe="3 weeks",
            )
        )
        
    # 5. Fallback recommendation if performance is high
    if not recommendations:
        recommendations.append(
            RecommendationItem(
                priority="low",
                title="Mentorship & System Architecture Expansion",
                description="Take on cross-functional technical tasks and assist junior team members through peer reviews.",
                reason="High technical quality and consistent delivery demonstrated across current period.",
                expected_outcome="Expand technical leadership and architecture ownership.",
                timeframe="4 weeks",
            )
        )
        
    return recommendations[:5]


def generate_learning_plan(
    data: PerformanceDataInput,
    metrics: DeterministicMetrics,
    recommendations: List[RecommendationItem],
) -> List[LearningPlanItem]:
    plans = []
    
    if metrics.late_rate > 15.0:
        plans.append(
            LearningPlanItem(
                skill="Time Management & Agile Estimation",
                priority="high",
                actions=[
                    "Review task breakdown techniques (WBS / Pomodoro)",
                    "Establish daily start-of-day task estimation logs",
                    "Communicate blockers to Lead at least 24h prior to deadline",
                ],
            )
        )
        
    if metrics.rejection_rate > 10.0 or data.revisions_count > 0:
        plans.append(
            LearningPlanItem(
                skill="Quality Assurance & Verification",
                priority="high",
                actions=[
                    "Build reusable self-verification checklist",
                    "Perform step-by-step verification before submission",
                    "Document edge case scenarios tested",
                ],
            )
        )
        
    if data.pr_count > 0 and (data.review_iterations > 2.0 or metrics.ci_failure_rate > 20.0):
        plans.append(
            LearningPlanItem(
                skill="Git Workflow & CI/CD Discipline",
                priority="medium",
                actions=[
                    "Review repository pull request contribution guidelines",
                    "Run pre-commit hooks and local unit test suites",
                    "Address reviewer inline comments systematically",
                ],
            )
        )
        
    if not plans:
        plans.append(
            LearningPlanItem(
                skill="Advanced System Design & Best Practices",
                priority="medium",
                actions=[
                    "Study existing InternOps module architectural patterns",
                    "Participate in design reviews and technical RFC discussions",
                ],
            )
        )
        
    return plans[:4]
