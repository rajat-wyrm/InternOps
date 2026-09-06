import json
import logging
from typing import Dict, Any, List

from app.performance.schemas import (
    PerformanceDataInput,
    PerformanceReviewResponse,
    EvidenceItem,
)
from app.performance.scoring import calculate_overall_performance
from app.performance.patterns import (
    detect_early_warnings,
    extract_strengths,
    extract_development_areas,
    extract_recurring_issues,
    calculate_performance_trend,
)
from app.performance.recommendations import (
    generate_recommendations,
    generate_learning_plan,
)
from app.performance.prompts import (
    PERFORMANCE_ANALYST_SYSTEM_PROMPT,
    build_analysis_prompt,
)
from app.providers.orchestrator import ai_orchestrator, AIProviderError

logger = logging.getLogger(__name__)


def build_evidence_items(
    data: PerformanceDataInput, metrics
) -> List[EvidenceItem]:
    items = []
    
    if data.tasks_assigned > 0:
        items.append(
            EvidenceItem(
                type="task",
                description=f"Task Completion Rate: {metrics.completion_rate}% ({data.tasks_completed}/{data.tasks_assigned} tasks completed)",
                metric_value={"completed": data.tasks_completed, "assigned": data.tasks_assigned},
                impact="Baseline measure of task execution.",
            )
        )
        items.append(
            EvidenceItem(
                type="task",
                description=f"On-Time Submission Rate: {metrics.on_time_rate}% ({data.tasks_late} late tasks)",
                metric_value={"late": data.tasks_late, "rate": metrics.on_time_rate},
                impact="Measures timeliness and schedule adherence.",
            )
        )
        
    if metrics.avg_eval_score > 0:
        items.append(
            EvidenceItem(
                type="rating",
                description=f"Average Evaluation Score: {metrics.avg_eval_score}/10",
                metric_value=metrics.avg_eval_score,
                impact="Direct evaluator quality assessment.",
            )
        )
        
    if data.ratings_count > 0:
        items.append(
            EvidenceItem(
                type="rating",
                description=f"Average Performance Rating: {metrics.avg_rating}/10 across {data.ratings_count} ratings",
                metric_value=metrics.avg_rating,
                impact="Manager and peer performance evaluation score.",
            )
        )
        
    if data.pr_count > 0:
        items.append(
            EvidenceItem(
                type="pr",
                description=f"GitHub Activity: {data.merged_prs}/{data.pr_count} PRs merged with avg {data.review_iterations} review iterations",
                metric_value={"prs": data.pr_count, "iterations": data.review_iterations},
                impact="Code quality and review turnaround indicator.",
            )
        )
        
    if data.issue_count > 0:
        items.append(
            EvidenceItem(
                type="issue",
                description=f"Issues Flagged: {data.issue_count} total issues with {len(data.recurring_issue_types)} recurring themes",
                metric_value={"count": data.issue_count, "recurring": data.recurring_issue_types},
                impact="Work correction and feedback frequency.",
            )
        )
        
    if data.attendance_days > 0:
        items.append(
            EvidenceItem(
                type="attendance",
                description=f"Attendance: {data.attendance_days} days present, {data.absent_days} absent, {data.late_days} late",
                metric_value={"present": data.attendance_days, "absent": data.absent_days},
                impact="Work context and reliability signal.",
            )
        )
        
    return items


async def analyze_performance(data: PerformanceDataInput) -> PerformanceReviewResponse:
    # 1. Deterministic Engine Scoring
    overall_score, level, confidence, dim_scores, metrics, status = (
        calculate_overall_performance(data)
    )
    
    # 2. Pattern Detection
    early_warning = detect_early_warnings(data, metrics, overall_score, status)
    strengths = extract_strengths(data, metrics, dim_scores)
    dev_areas = extract_development_areas(data, metrics, dim_scores)
    recurring_issues = extract_recurring_issues(data)
    trend = calculate_performance_trend(data, overall_score, status)
    
    # 3. Recommendation Engine
    recommendations = generate_recommendations(data, metrics, dev_areas, recurring_issues)
    learning_plan = generate_learning_plan(data, metrics, recommendations)
    evidence_list = build_evidence_items(data, metrics)
    
    # 4. Handle Insufficient Data Case
    if status == "insufficient_data":
        return PerformanceReviewResponse(
            overall_score=0.0,
            performance_level="Insufficient Data",
            confidence=0.30,
            status="insufficient_data",
            summary=f"Insufficient performance signals recorded for intern {data.intern_name or data.intern_id} in period {data.review_period_start} to {data.review_period_end}.",
            score_breakdown=dim_scores,
            deterministic_metrics=metrics,
            strengths=[],
            development_areas=[],
            recurring_issues=[],
            early_warning=early_warning,
            performance_trend=trend,
            recommendations=[],
            learning_plan=[],
            manager_summary="No sufficient tasks, evaluations, or performance ratings are available for this period to generate an evidence-backed review.",
            intern_feedback="Please ensure tasks are assigned and completed in order to receive personalized performance feedback.",
            evidence=evidence_list,
        )
        
    # 5. Build AI Summaries via LLM Orchestrator
    data_summary = f"""
Intern Name: {data.intern_name or data.intern_id}
Department: {data.department or 'Engineering'}
Review Period: {data.review_period_start} to {data.review_period_end}

Overall Score: {overall_score}/100 ({level})
Dimension Scores: {json.dumps(dim_scores)}
Deterministic Metrics: {json.dumps(metrics.dict())}

Strengths: {[s.area for s in strengths]}
Development Areas: {[d.area for d in dev_areas]}
Recurring Issues: {[r.issue for r in recurring_issues]}
Early Warning State: {early_warning.state} (Triggers: {early_warning.triggers})
Trend: {trend.direction} (Change: {trend.change})

Recommendations: {[r.title for r in recommendations]}
"""

    summary_text = (
        f"Performance is rated as {level} ({overall_score}/100) with a {trend.direction} trend. "
        f"Key strength areas include {strengths[0].area if strengths else 'Task Execution'}. "
        f"{'Focus area is ' + dev_areas[0].area if dev_areas else 'Maintain current performance standards.'}"
    )
    
    manager_summary = (
        f"Intern {data.intern_name or data.intern_id} demonstrated {level.lower()} performance during this period with an overall score of {overall_score}/100. "
        f"Task completion rate is {metrics.completion_rate}% and average evaluation score is {metrics.avg_eval_score}/10. "
        f"{'Early warning state is ' + early_warning.state + '.' if early_warning.state != 'Healthy' else 'No critical risk flags detected.'} "
        f"Recommended manager focus: support the intern in working through the action plan for {dev_areas[0].area if dev_areas else 'advanced deliverables'}."
    )
    
    intern_feedback = (
        f"Great effort during this review period! Your overall performance level is {level} ({overall_score}/100). "
        f"You showed strong results in {strengths[0].area if strengths else 'your assigned work'}. "
        f"To take your work to the next level, focus on {dev_areas[0].area if dev_areas else 'refining your technical skills'} "
        f"and follow the recommended action plan."
    )

    # Attempt AI narrative generation if AI provider available
    try:
        prompt_text = build_analysis_prompt(data_summary)
        ai_response, _ = await ai_orchestrator.generate_json_with_fallback(
            prompt=prompt_text,
            schema={
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                    "manager_summary": {"type": "string"},
                    "intern_feedback": {"type": "string"},
                },
            },
            temperature=0.3,
        )
        if isinstance(ai_response, dict):
            if ai_response.get("summary"):
                summary_text = ai_response["summary"]
            if ai_response.get("manager_summary"):
                manager_summary = ai_response["manager_summary"]
            if ai_response.get("intern_feedback"):
                intern_feedback = ai_response["intern_feedback"]
    except Exception as exc:
        logger.warning(f"AI LLM generation fallback triggered: {exc}")
        
    return PerformanceReviewResponse(
        overall_score=overall_score,
        performance_level=level,
        confidence=confidence,
        status="completed",
        summary=summary_text,
        score_breakdown=dim_scores,
        deterministic_metrics=metrics,
        strengths=strengths,
        development_areas=dev_areas,
        recurring_issues=recurring_issues,
        early_warning=early_warning,
        performance_trend=trend,
        recommendations=recommendations,
        learning_plan=learning_plan,
        manager_summary=manager_summary,
        intern_feedback=intern_feedback,
        evidence=evidence_list,
    )
