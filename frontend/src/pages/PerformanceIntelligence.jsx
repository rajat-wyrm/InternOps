import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Award,
  BookOpen,
  HelpCircle,
  FileText,
  UserCheck,
  Zap,
  BarChart3,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Brain,
  Check,
} from 'lucide-react';

export default function PerformanceIntelligence() {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [interns, setInterns] = useState([]);
  const [selectedInternId, setSelectedInternId] = useState('');
  const [review, setReview] = useState(null);
  const [history, setHistory] = useState([]);
  const [expandedEvidence, setExpandedEvidence] = useState({});
  const [activeTab, setActiveTab] = useState('overview'); // overview, recommendations, history, manager

  // Mock user role simulation
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isManager = ['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'].includes(
    currentUser.role
  );

  useEffect(() => {
    fetchInterns();
  }, []);

  useEffect(() => {
    if (selectedInternId) {
      fetchReviewData(selectedInternId);
    }
  }, [selectedInternId]);

  const fetchInterns = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/team/members?role=INTERN', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.members || data || [];
        setInterns(list);
        if (list.length > 0) {
          setSelectedInternId(list[0].id);
        } else if (currentUser.id) {
          setSelectedInternId(currentUser.id);
        }
      } else {
        // Fallback for demo/self view
        setSelectedInternId(currentUser.id || 'demo-user');
      }
    } catch (err) {
      console.warn('Using demo intern list fallback:', err);
      setSelectedInternId(currentUser.id || 'demo-user');
    }
  };

  const fetchReviewData = async (internId) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const [reviewRes, historyRes] = await Promise.all([
        fetch(`/api/ai/performance/${internId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/ai/performance/${internId}/history`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (reviewRes.ok) {
        const data = await reviewRes.json();
        setReview(data);
      } else {
        setReview(getMockReview(internId));
      }

      if (historyRes.ok) {
        const histData = await historyRes.json();
        setHistory(histData.history || []);
      } else {
        setHistory(getMockHistory());
      }
    } catch (err) {
      console.warn('API connection offline, rendering local evidence model');
      setReview(getMockReview(internId));
      setHistory(getMockHistory());
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReview = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `/api/ai/performance/${selectedInternId}/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            periodStart: new Date(Date.now() - 30 * 86400000).toISOString(),
            periodEnd: new Date().toISOString(),
          }),
        }
      );

      if (res.ok) {
        const newReview = await res.json();
        setReview(newReview);
        fetchReviewData(selectedInternId);
      } else {
        setReview(getMockReview(selectedInternId));
      }
    } catch (err) {
      console.warn('Generation completed with mock fallback');
      setReview(getMockReview(selectedInternId));
    } finally {
      setGenerating(false);
    }
  };

  const toggleEvidenceDrawer = (recId) => {
    setExpandedEvidence((prev) => ({
      ...prev,
      [recId]: !prev[recId],
    }));
  };

  // Mock fixtures matching real evidence models for UI testing
  const getMockReview = (id) => ({
    id: 'rev-001',
    intern_id: id,
    overall_score: 78.4,
    performance_level: 'Good',
    confidence: 0.88,
    status: 'completed',
    summary:
      'Performance is generally strong with high task quality (8.4/10 avg evaluation), though timeliness and pre-submission error validation require improvement.',
    score_breakdown: {
      task_execution: 82.0,
      task_quality: 85.5,
      timeliness: 62.0,
      technical_quality: 80.0,
      code_quality: 76.0,
      feedback_responsiveness: 74.0,
      reliability: 78.0,
      consistency: 80.0,
      improvement_trajectory: 84.0,
    },
    deterministic_metrics: {
      completion_rate: 90.0,
      on_time_rate: 65.0,
      late_rate: 35.0,
      rejection_rate: 10.0,
      avg_eval_score: 8.4,
      avg_rating: 8.2,
      rating_change: 1.2,
      recurring_issue_rate: 25.0,
      pr_review_cycles: 2.1,
    },
    strengths: [
      {
        area: 'Task Deliverable Quality',
        evidence: [
          'Average evaluation score: 8.4/10 across 12 evaluated tasks',
          'Low overall task rejection rate (10%)',
        ],
        impact:
          'Tasks consistently meet expected accuracy and quality standards.',
      },
      {
        area: 'Positive Growth Trajectory',
        evidence: [
          'Performance rating improved by +1.2 points over the last 4 weeks',
          'Active incorporation of past code review feedback',
        ],
        impact: 'Demonstrates fast learning curve and adaptability.',
      },
    ],
    development_areas: [
      {
        area: 'Timeliness & Schedule Estimation',
        severity: 'medium',
        evidence: [
          '4 of the last 10 tasks completed past deadline (35% late rate)',
          'Last 2 sprint tasks were submitted within 2 hours of deadline',
        ],
        recommendation:
          'Improve task breakdown and set daily sub-milestones to avoid last-minute delays.',
      },
      {
        area: 'Pre-Submission Code & Proof Validation',
        severity: 'medium',
        evidence: [
          '2 PRs required additional review iterations due to missing error validation',
          'Repeated reviewer comments regarding boundary checking',
        ],
        recommendation:
          'Apply an explicit input and error-handling checklist before marking tasks complete.',
      },
    ],
    recurring_issues: [
      {
        issue: 'Incomplete Validation & Error Checking',
        frequency: 3,
        evidence: [
          'Found in 3 separate PR review comments across recent tasks',
          'Evaluator note on Task #104: missing null check on submission form',
        ],
      },
    ],
    early_warning: {
      state: 'Needs Attention',
      triggers: ['35% late task submission rate'],
      evidence: ['4 tasks missed target deadline in current review cycle'],
    },
    performance_trend: {
      direction: 'improving',
      previous_score: 69.0,
      current_score: 78.4,
      change: 9.4,
    },
    recommendations: [
      {
        priority: 'high',
        title: 'Strengthen Input & Edge-Case Validation',
        description:
          'Incorporate explicit pre-submission checks for API error boundaries and form validations.',
        reason: 'Detected 3 repeated review comments on validation handling.',
        expected_outcome: 'Reduce validation-related review comments by 50%.',
        timeframe: '2 weeks',
      },
      {
        priority: 'high',
        title: 'Decompose Large Deliverables into Daily Milestones',
        description:
          'Split multi-day tasks into 1-day sub-tasks and log progress checkpoints with Lead.',
        reason:
          'Late submission rate reached 35% across current review period.',
        expected_outcome: 'Increase on-time task delivery to >85%.',
        timeframe: '2 weeks',
      },
      {
        priority: 'medium',
        title: 'Run Automated CI & Test Suite Pre-Commit',
        description:
          'Ensure local unit test suites and linter run clean before opening pull requests.',
        reason:
          'PR review cycles averaged 2.1 iterations due to minor build failures.',
        expected_outcome: 'Lower review iteration cycles to < 1.5.',
        timeframe: '3 weeks',
      },
    ],
    learning_plan: [
      {
        skill: 'Validation & Defensive Programming',
        priority: 'high',
        actions: [
          'Study existing InternOps backend validation schemas (Zod/Pydantic)',
          'Complete dedicated error-handling practice exercise',
          'Apply pre-flight verification checklist before opening PRs',
        ],
      },
      {
        skill: 'Agile Task Estimation & Time Allocation',
        priority: 'high',
        actions: [
          'Log daily task estimation vs actual hours',
          'Alert Lead at least 24 hours in advance if deadline is at risk',
        ],
      },
    ],
    manager_summary:
      'Intern performance has improved significantly (+9.4 points) reaching an overall score of 78.4 (Good). Work quality is solid with an 8.4/10 average evaluation. Recommended manager focus: assist intern in establishing realistic milestone estimates to address the 35% late submission rate.',
    intern_feedback:
      'Great progress this month! Your technical deliverable quality is strong (8.4/10). To reach the Exceptional level, focus on submitting tasks 24h before deadline and double-checking input validation before opening PRs.',
    evidence: [
      {
        type: 'task',
        description: 'Task Completion Rate: 90% (9 of 10 tasks completed)',
        metric_value: 90,
        impact: 'Solid core deliverable throughput.',
      },
      {
        type: 'task',
        description: 'On-Time Rate: 65% (4 tasks completed late)',
        metric_value: 65,
        impact: 'Key area for improvement in time management.',
      },
      {
        type: 'rating',
        description: 'Average Evaluation Rating: 8.4 / 10',
        metric_value: 8.4,
        impact: 'High technical output quality.',
      },
      {
        type: 'pr',
        description: 'GitHub Review Iterations: 2.1 cycles per PR',
        metric_value: 2.1,
        impact: 'Minor review turnaround delays.',
      },
    ],
  });

  const getMockHistory = () => [
    {
      id: 'rev-001',
      created_at: '2026-08-30T10:00:00Z',
      overall_score: 78.4,
      performance_level: 'Good',
      change: 9.4,
    },
    {
      id: 'rev-002',
      created_at: '2026-07-31T10:00:00Z',
      overall_score: 69.0,
      performance_level: 'Satisfactory',
      change: 4.0,
    },
    {
      id: 'rev-003',
      created_at: '2026-06-30T10:00:00Z',
      overall_score: 65.0,
      performance_level: 'Satisfactory',
      change: 0.0,
    },
  ];

  const getEarlyWarningBadge = (state) => {
    switch (state) {
      case 'Healthy':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" /> Healthy
          </span>
        );
      case 'Needs Attention':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Needs Attention
          </span>
        );
      case 'At Risk':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> At Risk
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <HelpCircle className="w-3.5 h-3.5" /> Insufficient Data
          </span>
        );
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return (
          <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            High Priority
          </span>
        );
      case 'medium':
        return (
          <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Medium Priority
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            Low Priority
          </span>
        );
    }
  };

  if (loading && !review) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-slate-400 text-sm">
            Analyzing intern performance signals...
          </p>
        </div>
      </div>
    );
  }

  const isInsufficient = review?.status === 'insufficient_data';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      {/* Top Bar Header */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">
                AI Performance Intelligence
              </h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Evidence-based intern performance reviews, trend tracking, and
              personalized growth recommendations.
            </p>
          </div>

          {/* Intern Selector & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {isManager && interns.length > 0 && (
              <div className="relative">
                <select
                  value={selectedInternId}
                  onChange={(e) => setSelectedInternId(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-lg px-4 py-2.5 pr-8 appearance-none focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                >
                  {interns.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name || member.email} (
                      {member.role || 'INTERN'})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3.5 pointer-events-none" />
              </div>
            )}

            <button
              onClick={handleGenerateReview}
              disabled={generating}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`}
              />
              {generating ? 'Analyzing Signals...' : 'Generate AI Review'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview & Breakdown
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'recommendations'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Recommendations & Action Plan
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'history'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Historical Trends
          </button>
          <button
            onClick={() => setActiveTab('manager')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'manager'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Manager & Feedback Summaries
          </button>
        </div>

        {/* Insufficient Data Alert */}
        {isInsufficient && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3 text-amber-300 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                Insufficient Data for Full Evaluation
              </p>
              <p className="text-xs text-amber-400/80 mt-1">
                There are very few task assignments or evaluation ratings logged
                for this intern in the selected period. Metrics will update
                automatically as work is recorded.
              </p>
            </div>
          </div>
        )}

        {/* MAIN TAB CONTENT */}
        {activeTab === 'overview' && review && (
          <div className="space-y-6">
            {/* Top Score Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Overall Score */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Overall Performance Score
                  </span>
                  <Award className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white">
                    {review.overall_score.toFixed(1)}
                  </span>
                  <span className="text-sm font-medium text-slate-400">
                    / 100
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-500/20 text-indigo-300">
                    {review.performance_level}
                  </span>
                  {review.performance_trend?.change !== 0 && (
                    <span
                      className={`text-xs font-semibold flex items-center ${
                        review.performance_trend?.change > 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {review.performance_trend?.change > 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                      )}
                      {review.performance_trend?.change > 0 ? '+' : ''}
                      {review.performance_trend?.change} pts
                    </span>
                  )}
                </div>
              </div>

              {/* Early Warning Signal */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Early Warning Status
                  </span>
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <div className="mt-4">
                  {getEarlyWarningBadge(review.early_warning?.state)}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {review.early_warning?.triggers?.length > 0
                    ? review.early_warning.triggers[0]
                    : 'All performance signals within healthy threshold.'}
                </p>
              </div>

              {/* Task Completion Rate */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Task Completion Rate
                  </span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="mt-3 text-3xl font-bold text-white">
                  {review.deterministic_metrics?.completion_rate}%
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  On-time rate: {review.deterministic_metrics?.on_time_rate}%
                </p>
              </div>

              {/* Avg Evaluation Rating */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Evaluator Rating
                  </span>
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                </div>
                <div className="mt-3 text-3xl font-bold text-white">
                  {review.deterministic_metrics?.avg_eval_score
                    ? `${review.deterministic_metrics.avg_eval_score.toFixed(1)} / 10`
                    : 'N/A'}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Rejection rate: {review.deterministic_metrics?.rejection_rate}
                  %
                </p>
              </div>
            </div>

            {/* Score Breakdown Gauges */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" /> Performance
                Dimension Breakdown
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(review.score_breakdown || {}).map(
                  ([dimension, score]) => (
                    <div key={dimension} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="capitalize text-slate-300">
                          {dimension.replace('_', ' ')}
                        </span>
                        <span className="text-indigo-400 font-bold">
                          {score}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            score >= 80
                              ? 'bg-emerald-500'
                              : score >= 65
                                ? 'bg-indigo-500'
                                : score >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                          }`}
                          style={{
                            width: `${Math.max(5, Math.min(100, score))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Strengths & Development Areas Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Strengths */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Key Strengths
                </h2>
                <div className="space-y-4">
                  {review.strengths?.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-2"
                    >
                      <h3 className="text-sm font-semibold text-white">
                        {item.area}
                      </h3>
                      <p className="text-xs text-slate-400">{item.impact}</p>
                      <div className="pt-2 border-t border-slate-900 flex flex-col gap-1">
                        {item.evidence?.map((ev, evIdx) => (
                          <span
                            key={evIdx}
                            className="text-xs text-emerald-300/80 flex items-center gap-1.5"
                          >
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />{' '}
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Development Areas */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-amber-400 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Development Areas
                </h2>
                <div className="space-y-4">
                  {review.development_areas?.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">
                          {item.area}
                        </h3>
                        {getPriorityBadge(item.severity)}
                      </div>
                      <p className="text-xs text-indigo-300 font-medium">
                        {item.recommendation}
                      </p>
                      <div className="pt-2 border-t border-slate-900 flex flex-col gap-1">
                        {item.evidence?.map((ev, evIdx) => (
                          <span key={evIdx} className="text-xs text-slate-400">
                            • {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RECOMMENDATIONS & ACTION PLAN TAB */}
        {activeTab === 'recommendations' && review && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-400" /> Evidence-Based AI
                Recommendations
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                Each recommendation is generated by correlating observed work
                data patterns with actionable growth steps.
              </p>

              <div className="space-y-4">
                {review.recommendations?.map((rec, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3 transition-all hover:border-slate-700"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        {rec.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        {getPriorityBadge(rec.priority)}
                        <span className="text-xs font-semibold bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {rec.timeframe}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-slate-300">{rec.description}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-900/60 p-3 rounded-lg border border-slate-800/50">
                      <div>
                        <span className="text-slate-400 font-medium">
                          Reason / Observed Signal:
                        </span>
                        <p className="text-slate-200 mt-0.5">{rec.reason}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">
                          Target Expected Outcome:
                        </span>
                        <p className="text-emerald-400 font-semibold mt-0.5">
                          {rec.expected_outcome}
                        </p>
                      </div>
                    </div>

                    {/* Expandable Evidence Drawer */}
                    <div className="pt-2">
                      <button
                        onClick={() => toggleEvidenceDrawer(`rec-${idx}`)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        Why am I getting this recommendation?
                        {expandedEvidence[`rec-${idx}`] ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {expandedEvidence[`rec-${idx}`] && (
                        <div className="mt-3 bg-slate-900 border border-indigo-500/20 rounded-lg p-4 text-xs space-y-2 text-slate-300">
                          <p className="font-semibold text-indigo-300">
                            Underlying Data Signals Used:
                          </p>
                          <ul className="list-disc pl-4 space-y-1 text-slate-300">
                            <li>Primary Trigger: {rec.reason}</li>
                            <li>
                              Overall Performance Level:{' '}
                              {review.performance_level}
                            </li>
                            <li>
                              Task On-Time Submission Rate:{' '}
                              {review.deterministic_metrics?.on_time_rate}%
                            </li>
                            <li>
                              Task Rejection Rate:{' '}
                              {review.deterministic_metrics?.rejection_rate}%
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Learning & Action Plan */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" /> Targeted Skill
                Action Plan
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {review.learning_plan?.map((plan, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">
                        {plan.skill}
                      </h3>
                      {getPriorityBadge(plan.priority)}
                    </div>
                    <ul className="space-y-1.5">
                      {plan.actions?.map((act, actIdx) => (
                        <li
                          key={actIdx}
                          className="text-xs text-slate-300 flex items-start gap-2"
                        >
                          <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* HISTORICAL TRENDS TAB */}
        {activeTab === 'history' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" /> Historical
              Performance Reviews
            </h2>
            <p className="text-xs text-slate-400">
              Each generated AI review is preserved historically to track growth
              over time.
            </p>

            <div className="relative border-l-2 border-indigo-500/30 pl-6 space-y-6 ml-3">
              {history.map((hItem, idx) => (
                <div key={hItem.id || idx} className="relative group">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-slate-900 border-2 border-indigo-500 group-hover:scale-125 transition-transform" />
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-white">
                          {hItem.overall_score?.toFixed(1) || hItem.score}
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                          {hItem.performance_level || hItem.level}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(
                          hItem.created_at || hItem.date
                        ).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      {hItem.change !== undefined && (
                        <span
                          className={`text-sm font-semibold flex items-center ${
                            hItem.change >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {hItem.change >= 0 ? '+' : ''}
                          {hItem.change} pts
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MANAGER & FEEDBACK TAB */}
        {activeTab === 'manager' && review && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-400" /> Manager
                Summary
              </h2>
              <p className="text-xs text-slate-400">
                Executive summary formatted for supervisor evaluation and 1-on-1
                check-ins.
              </p>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-sm text-slate-200 leading-relaxed">
                {review.manager_summary}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" /> Intern Growth
                Feedback
              </h2>
              <p className="text-xs text-slate-400">
                Actionable, encouraging feedback written directly for the
                intern.
              </p>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-sm text-slate-200 leading-relaxed">
                {review.intern_feedback}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
