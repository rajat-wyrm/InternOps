from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class PerformanceWeights(BaseModel):
    task_execution: float = 0.20
    task_quality: float = 0.15
    timeliness: float = 0.10
    technical_quality: float = 0.15
    code_quality: float = 0.15
    feedback_responsiveness: float = 0.10
    reliability: float = 0.05
    consistency: float = 0.05
    improvement_trajectory: float = 0.05


class PerformanceDataInput(BaseModel):
    intern_id: str
    intern_name: Optional[str] = "Intern"
    department: Optional[str] = "Engineering"
    review_period_start: str
    review_period_end: str
    
    # Raw signals
    tasks_assigned: int = 0
    tasks_completed: int = 0
    tasks_late: int = 0
    tasks_rejected: int = 0
    tasks_reopened: int = 0
    revisions_count: int = 0
    avg_evaluation_score: Optional[float] = None
    
    ratings_count: int = 0
    avg_rating_score: Optional[float] = None
    historical_ratings: List[float] = Field(default_factory=list)
    rating_comments: List[str] = Field(default_factory=list)
    
    issue_count: int = 0
    recurring_issue_types: List[str] = Field(default_factory=list)
    rejection_reasons: List[str] = Field(default_factory=list)
    
    pr_count: int = 0
    merged_prs: int = 0
    review_iterations: float = 0.0
    review_comments: List[str] = Field(default_factory=list)
    ci_failures: int = 0
    
    attendance_days: int = 0
    absent_days: int = 0
    late_days: int = 0
    
    previous_review: Optional[Dict[str, Any]] = None
    custom_weights: Optional[PerformanceWeights] = None


class DeterministicMetrics(BaseModel):
    completion_rate: float = 0.0
    on_time_rate: float = 0.0
    late_rate: float = 0.0
    rejection_rate: float = 0.0
    revision_rate: float = 0.0
    avg_eval_score: float = 0.0
    avg_rating: float = 0.0
    rating_change: float = 0.0
    recurring_issue_rate: float = 0.0
    pr_review_cycles: float = 0.0
    ci_failure_rate: float = 0.0
    improvement_pct: float = 0.0
    consistency_score: float = 0.0
    signal_count: int = 0


class StrengthItem(BaseModel):
    area: str
    evidence: List[str]
    impact: str


class DevelopmentAreaItem(BaseModel):
    area: str
    severity: str  # high, medium, low
    evidence: List[str]
    recommendation: str


class RecurringIssueItem(BaseModel):
    issue: str
    frequency: int
    evidence: List[str]


class PerformanceTrend(BaseModel):
    direction: str  # improving, stable, declining, volatile, insufficient_data
    previous_score: Optional[float] = None
    current_score: float
    change: float


class RecommendationItem(BaseModel):
    priority: str  # high, medium, low
    title: str
    description: str
    reason: str
    expected_outcome: str
    timeframe: str


class LearningPlanItem(BaseModel):
    skill: str
    priority: str
    actions: List[str]


class EarlyWarning(BaseModel):
    state: str  # Healthy, Needs Attention, At Risk, Insufficient Data
    triggers: List[str] = Field(default_factory=list)
    evidence: List[str] = Field(default_factory=list)


class EvidenceItem(BaseModel):
    type: str  # task, rating, pr, issue, attendance
    description: str
    metric_value: Optional[Any] = None
    impact: str


class PerformanceReviewResponse(BaseModel):
    overall_score: float
    performance_level: str
    confidence: float
    status: str = "completed"  # completed or insufficient_data
    
    summary: str
    score_breakdown: Dict[str, float]
    deterministic_metrics: DeterministicMetrics
    
    strengths: List[StrengthItem]
    development_areas: List[DevelopmentAreaItem]
    recurring_issues: List[RecurringIssueItem]
    early_warning: EarlyWarning
    performance_trend: PerformanceTrend
    
    recommendations: List[RecommendationItem]
    learning_plan: List[LearningPlanItem]
    
    manager_summary: str
    intern_feedback: str
    evidence: List[EvidenceItem]
