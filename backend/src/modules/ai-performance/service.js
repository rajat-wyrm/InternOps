const config = require('../../config');
const repository = require('./repository');

async function generateReview(
  internId,
  createdByUserId,
  periodStart,
  periodEnd
) {
  // 1. Gather intern performance data signals
  const rawData = await repository.gatherInternPerformanceData(
    internId,
    periodStart,
    periodEnd
  );

  const aiServiceUrl =
    config.ai?.fastapiUrl ||
    process.env.AI_SERVICE_URL ||
    'http://localhost:8000';
  let reviewResult = null;

  // 2. Call Python AI service endpoint POST /ai/performance/review
  try {
    const response = await fetch(`${aiServiceUrl}/ai/performance/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rawData),
    });

    if (response.ok) {
      reviewResult = await response.json();
    } else {
      console.warn(
        `[AI Performance] Python AI service responded status ${response.status}`
      );
    }
  } catch (err) {
    console.warn(
      `[AI Performance] Could not connect to Python AI service: ${err.message}. Using fallback engine.`
    );
  }

  // 3. Fallback Scoring Engine if Python AI service is unavailable
  if (!reviewResult) {
    reviewResult = fallbackLocalScoring(rawData);
  }

  // 4. Save historical snapshot in PostgreSQL
  const savedRecord = await repository.savePerformanceReview({
    intern_id: internId,
    created_by: createdByUserId,
    review_period_start: rawData.review_period_start,
    review_period_end: rawData.review_period_end,
    overall_score: reviewResult.overall_score,
    performance_level: reviewResult.performance_level,
    confidence: reviewResult.confidence || 0.85,
    status: reviewResult.status || 'completed',
    summary: reviewResult.summary || '',
    score_breakdown: reviewResult.score_breakdown || {},
    deterministic_metrics: reviewResult.deterministic_metrics || {},
    strengths: reviewResult.strengths || [],
    development_areas: reviewResult.development_areas || [],
    recurring_issues: reviewResult.recurring_issues || [],
    recommendations: reviewResult.recommendations || [],
    learning_plan: reviewResult.learning_plan || [],
    early_warning: reviewResult.early_warning || {},
    performance_trend: reviewResult.performance_trend || {},
    manager_summary: reviewResult.manager_summary || '',
    intern_feedback: reviewResult.intern_feedback || '',
    evidence: reviewResult.evidence || [],
    model_provider: reviewResult.model_provider || 'gemini',
    model_name: reviewResult.model_name || 'gemini-2.5-flash',
  });

  return savedRecord;
}

function fallbackLocalScoring(data) {
  const totalTasks = data.tasks_assigned || 0;
  const completed = data.tasks_completed || 0;
  const late = data.tasks_late || 0;
  const rejected = data.tasks_rejected || 0;

  if (totalTasks === 0 && (data.ratings_count || 0) === 0) {
    return {
      overall_score: 0.0,
      performance_level: 'Insufficient Data',
      confidence: 0.3,
      status: 'insufficient_data',
      summary: 'Insufficient performance signals in review period.',
      score_breakdown: {},
      deterministic_metrics: { completion_rate: 0, on_time_rate: 0 },
      strengths: [],
      development_areas: [],
      recurring_issues: [],
      early_warning: { state: 'Insufficient Data', triggers: [], evidence: [] },
      performance_trend: {
        direction: 'insufficient_data',
        change: 0,
        current_score: 0,
      },
      recommendations: [],
      learning_plan: [],
      manager_summary: 'No sufficient task or evaluation data available.',
      intern_feedback:
        'Complete assigned tasks to receive personalized AI review.',
      evidence: [],
    };
  }

  const completionRate = totalTasks > 0 ? (completed / totalTasks) * 100 : 0;
  const onTimeRate =
    totalTasks > 0 ? Math.max(0, ((completed - late) / totalTasks) * 100) : 0;
  const avgRating = data.avg_rating_score || 7.0;

  const score = Math.round(
    completionRate * 0.4 + onTimeRate * 0.3 + avgRating * 3.0
  );
  const clampedScore = Math.max(0, Math.min(100, score));

  let level = 'Satisfactory';
  if (clampedScore >= 88) level = 'Exceptional';
  else if (clampedScore >= 75) level = 'Good';
  else if (clampedScore < 50) level = 'Needs Improvement';

  return {
    overall_score: clampedScore,
    performance_level: level,
    confidence: 0.85,
    status: 'completed',
    summary: `Performance is rated ${level} (${clampedScore}/100) based on task execution and rating history.`,
    score_breakdown: {
      task_execution: Math.round(completionRate),
      timeliness: Math.round(onTimeRate),
      task_quality: Math.round(avgRating * 10),
      technical_quality: Math.round(avgRating * 10),
      code_quality: Math.round(avgRating * 10),
      feedback_responsiveness: 75,
      reliability: Math.round(onTimeRate),
      consistency: 75,
      improvement_trajectory: 75,
    },
    deterministic_metrics: {
      completion_rate: completionRate,
      on_time_rate: onTimeRate,
      late_rate: totalTasks > 0 ? (late / totalTasks) * 100 : 0,
      rejection_rate: totalTasks > 0 ? (rejected / totalTasks) * 100 : 0,
      avg_eval_score: avgRating,
      avg_rating: avgRating,
    },
    strengths: [
      {
        area: 'Task Completion',
        evidence: [`${completed} of ${totalTasks} tasks completed`],
        impact: 'Delivers assigned deliverables.',
      },
    ],
    development_areas:
      late > 0
        ? [
            {
              area: 'Timeliness',
              severity: 'medium',
              evidence: [`${late} tasks completed late`],
              recommendation: 'Improve deadline estimation.',
            },
          ]
        : [],
    recurring_issues: [],
    early_warning: {
      state: clampedScore < 60 ? 'Needs Attention' : 'Healthy',
      triggers: late > 0 ? ['Late task submissions'] : [],
      evidence: [],
    },
    performance_trend: {
      direction: 'stable',
      current_score: clampedScore,
      change: 0,
    },
    recommendations: [
      {
        priority: 'high',
        title: 'Maintain Consistent Task Milestones',
        description:
          'Set daily sub-goals to avoid last-minute deadline pressure.',
        reason: 'To improve timeliness and task submission quality.',
        expected_outcome: 'Higher on-time completion rate.',
        timeframe: '2 weeks',
      },
    ],
    learning_plan: [
      {
        skill: 'Time Management',
        priority: 'high',
        actions: [
          'Log daily milestone updates',
          'Notify TL 24h prior to deadline',
        ],
      },
    ],
    manager_summary: `Intern achieved score of ${clampedScore}/100 (${level}). Task completion rate is ${Math.round(completionRate)}%.`,
    intern_feedback: `Great work! Your overall score is ${clampedScore}/100. Keep focusing on on-time submission and high quality.`,
    evidence: [],
  };
}

module.exports = {
  generateReview,
  getLatestReview: repository.getLatestReview,
  getReviewHistory: repository.getReviewHistory,
  getReviewById: repository.getReviewById,
};
