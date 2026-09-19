/**
 * risk.service.js
 *
 * Core risk prediction service.
 *
 * Architecture:
 *   raw DB signals
 *   → feature engineering (this file)
 *   → deterministic risk scoring
 *   → optional: AI service for enhanced explanation (with fallback)
 *   → explainable factor generation
 *   → risk prediction storage
 *
 * No ML model is used here because there is no historical labeled dataset.
 * The deterministic engine is designed so a trained model can replace/augment
 * it in future. Every score is computed from real operational data only.
 */
const config = require('../../config');
const riskRepo = require('./risk.repository');

// ---------------------------------------------------------------------------
// Thresholds — configurable via environment
// ---------------------------------------------------------------------------
const THRESHOLDS = {
  // Attendance
  attendance_warn: parseFloat(process.env.RISK_ATTENDANCE_WARN || '70'),
  attendance_critical: parseFloat(process.env.RISK_ATTENDANCE_CRITICAL || '50'),
  absence_streak_warn: parseInt(
    process.env.RISK_ABSENCE_STREAK_WARN || '3',
    10
  ),
  absence_streak_critical: parseInt(
    process.env.RISK_ABSENCE_STREAK_CRITICAL || '5',
    10
  ),
  attendance_decline_warn: parseFloat(
    process.env.RISK_ATTENDANCE_DECLINE_WARN || '-15'
  ),

  // Tasks
  completion_warn: parseFloat(process.env.RISK_COMPLETION_WARN || '70'),
  completion_critical: parseFloat(process.env.RISK_COMPLETION_CRITICAL || '50'),
  deadline_miss_warn: parseFloat(process.env.RISK_DEADLINE_MISS_WARN || '25'),
  deadline_miss_critical: parseFloat(
    process.env.RISK_DEADLINE_MISS_CRITICAL || '50'
  ),
  overdue_warn: parseInt(process.env.RISK_OVERDUE_WARN || '2', 10),

  // Ratings
  rating_warn: parseFloat(process.env.RISK_RATING_WARN || '5'),
  rating_critical: parseFloat(process.env.RISK_RATING_CRITICAL || '3'),
  rating_decline_warn: parseFloat(
    process.env.RISK_RATING_DECLINE_WARN || '-1.5'
  ),

  // Minimums for reliable prediction
  min_tasks_for_confidence: parseInt(process.env.RISK_MIN_TASKS || '2', 10),
  min_attendance_for_confidence: parseInt(
    process.env.RISK_MIN_ATTENDANCE || '3',
    10
  ),
};

// ---------------------------------------------------------------------------
// Feature engineering
// Converts raw gathered data into normalized 0-100 risk sub-scores
// Higher sub-score = worse (more risky)
// ---------------------------------------------------------------------------
function engineerFeatures(data) {
  const features = {};
  let signalCount = 0;

  // --- Attendance ---
  if (
    data.attendance_rate !== null &&
    data.attendance_total_marked >= THRESHOLDS.min_attendance_for_confidence
  ) {
    signalCount += data.attendance_total_marked;
    const rate = data.attendance_rate;
    // Attendance risk: low attendance = high risk
    if (rate >= 90) features.attendance_risk = 5;
    else if (rate >= THRESHOLDS.attendance_warn) features.attendance_risk = 25;
    else if (rate >= THRESHOLDS.attendance_critical)
      features.attendance_risk = 60;
    else features.attendance_risk = 90;

    // Absence streak risk
    if (data.absence_streak >= THRESHOLDS.absence_streak_critical) {
      features.absence_streak_risk = 85;
    } else if (data.absence_streak >= THRESHOLDS.absence_streak_warn) {
      features.absence_streak_risk = 55;
    } else if (data.absence_streak >= 2) {
      features.absence_streak_risk = 25;
    } else {
      features.absence_streak_risk = 5;
    }

    // Attendance trend
    if (data.attendance_trend_change <= THRESHOLDS.attendance_decline_warn) {
      features.attendance_trend_risk = 70;
    } else if (data.attendance_trend_change < -5) {
      features.attendance_trend_risk = 35;
    } else {
      features.attendance_trend_risk = 0;
    }
  }

  // --- Task completion ---
  if (data.tasks_assigned >= THRESHOLDS.min_tasks_for_confidence) {
    signalCount += data.tasks_assigned;
    const rate = data.completion_rate;
    if (rate >= 90) features.completion_risk = 5;
    else if (rate >= THRESHOLDS.completion_warn) features.completion_risk = 30;
    else if (rate >= THRESHOLDS.completion_critical)
      features.completion_risk = 65;
    else features.completion_risk = 90;

    // Deadline miss risk
    const dMissRate = data.deadline_miss_rate || 0;
    if (dMissRate >= THRESHOLDS.deadline_miss_critical) {
      features.deadline_miss_risk = 85;
    } else if (dMissRate >= THRESHOLDS.deadline_miss_warn) {
      features.deadline_miss_risk = 50;
    } else if (dMissRate > 10) {
      features.deadline_miss_risk = 20;
    } else {
      features.deadline_miss_risk = 5;
    }

    // Overdue/pending tasks
    if (data.tasks_overdue >= THRESHOLDS.overdue_warn + 2) {
      features.overdue_task_risk = 80;
    } else if (data.tasks_overdue >= THRESHOLDS.overdue_warn) {
      features.overdue_task_risk = 50;
    } else if (data.tasks_overdue === 1) {
      features.overdue_task_risk = 20;
    } else {
      features.overdue_task_risk = 5;
    }

    // Rejection rate
    const rejRate =
      data.tasks_assigned > 0
        ? (data.tasks_rejected / data.tasks_assigned) * 100
        : 0;
    if (rejRate >= 40) features.rejection_risk = 70;
    else if (rejRate >= 20) features.rejection_risk = 35;
    else features.rejection_risk = 5;

    // Recent activity (last 7 days)
    if (data.recent_completion_rate !== null && data.assigned_7d >= 1) {
      signalCount += data.assigned_7d;
      if (data.recent_completion_rate < 30) features.recent_activity_risk = 70;
      else if (data.recent_completion_rate < 60)
        features.recent_activity_risk = 35;
      else features.recent_activity_risk = 5;
    }
  }

  // --- Ratings ---
  if (data.ratings_count >= 1) {
    signalCount += data.ratings_count;
    const avg = data.avg_rating;
    if (avg !== null) {
      if (avg >= 8) features.rating_risk = 5;
      else if (avg >= THRESHOLDS.rating_warn) features.rating_risk = 25;
      else if (avg >= THRESHOLDS.rating_critical) features.rating_risk = 60;
      else features.rating_risk = 90;
    }

    // Rating trend
    const trend = data.rating_trend_change;
    if (trend <= THRESHOLDS.rating_decline_warn) {
      features.rating_trend_risk = 70;
    } else if (trend < -0.5) {
      features.rating_trend_risk = 30;
    } else {
      features.rating_trend_risk = 0;
    }

    // Consistency (high variance = risky)
    if (data.rating_variance > 4) features.consistency_risk = 50;
    else if (data.rating_variance > 2) features.consistency_risk = 25;
    else features.consistency_risk = 5;
  }

  return { features, signalCount };
}

// ---------------------------------------------------------------------------
// Weighted risk score calculation
// Weights sum to 1.0; each sub-score is 0-100 (higher = worse)
// ---------------------------------------------------------------------------
const FEATURE_WEIGHTS = {
  completion_risk: 0.22,
  deadline_miss_risk: 0.18,
  overdue_task_risk: 0.1,
  attendance_risk: 0.15,
  absence_streak_risk: 0.05,
  attendance_trend_risk: 0.05,
  rating_risk: 0.12,
  rating_trend_risk: 0.08,
  recent_activity_risk: 0.05,
  consistency_risk: 0.03,
  rejection_risk: 0.04,
  // (remaining absence + rejection share not explicitly listed defaults to 0)
};

function computeRiskScore(features) {
  let weightedSum = 0;
  let appliedWeight = 0;

  for (const [key, weight] of Object.entries(FEATURE_WEIGHTS)) {
    if (features[key] !== undefined) {
      weightedSum += features[key] * weight;
      appliedWeight += weight;
    }
  }

  if (appliedWeight === 0) return 0;
  // Scale to full 100 range
  return Math.round(Math.min(100, weightedSum / appliedWeight));
}

// ---------------------------------------------------------------------------
// Compute confidence based on available signal count and intern age
// ---------------------------------------------------------------------------
function computeConfidence(signalCount, internAgeDays) {
  // New interns (< 14 days) get reduced confidence
  const ageFactor = internAgeDays < 7 ? 0.5 : internAgeDays < 14 ? 0.7 : 1.0;
  const signalFactor = Math.min(1.0, 0.3 + signalCount * 0.04);
  return Math.round(ageFactor * signalFactor * 100) / 100;
}

// ---------------------------------------------------------------------------
// Generate human-readable explainable factors from features + raw data
// ---------------------------------------------------------------------------
function buildFactors(features, data) {
  const factors = [];
  const { classifyRisk } = riskRepo;

  const add = (factor, impact, description, value) => {
    factors.push({ factor, impact, description, value });
  };

  // Task completion
  if (features.completion_risk !== undefined && data.tasks_assigned > 0) {
    add(
      'Task Completion Rate',
      features.completion_risk >= 60
        ? 'HIGH'
        : features.completion_risk >= 25
          ? 'MEDIUM'
          : 'LOW',
      `Completed ${data.tasks_completed} of ${data.tasks_assigned} assigned tasks (${(data.completion_rate || 0).toFixed(1)}% completion rate).`,
      data.completion_rate
    );
  }

  // Deadline misses
  if (features.deadline_miss_risk !== undefined && data.tasks_late > 0) {
    add(
      'Deadline Miss Rate',
      features.deadline_miss_risk >= 60
        ? 'HIGH'
        : features.deadline_miss_risk >= 30
          ? 'MEDIUM'
          : 'LOW',
      `${data.tasks_late} of ${data.tasks_assigned} tasks were submitted after their deadline (${(data.deadline_miss_rate || 0).toFixed(1)}% miss rate).`,
      data.deadline_miss_rate
    );
  }

  // Overdue tasks
  if (features.overdue_task_risk !== undefined && data.tasks_overdue > 0) {
    add(
      'Overdue Tasks',
      features.overdue_task_risk >= 50 ? 'HIGH' : 'MEDIUM',
      `${data.tasks_overdue} assigned task(s) are currently past their deadline and still incomplete.`,
      data.tasks_overdue
    );
  }

  // Attendance
  if (features.attendance_risk !== undefined) {
    add(
      'Attendance Rate',
      features.attendance_risk >= 60
        ? 'HIGH'
        : features.attendance_risk >= 25
          ? 'MEDIUM'
          : 'LOW',
      `Present ${data.attendance_present} of ${data.attendance_total_marked} marked days (${(data.attendance_rate || 0).toFixed(1)}% attendance rate).`,
      data.attendance_rate
    );
  }

  // Absence streak
  if (features.absence_streak_risk !== undefined && data.absence_streak >= 2) {
    add(
      'Consecutive Absences',
      features.absence_streak_risk >= 55 ? 'HIGH' : 'MEDIUM',
      `${data.absence_streak} consecutive absent days detected in the most recent attendance records.`,
      data.absence_streak
    );
  }

  // Attendance trend
  if (
    features.attendance_trend_risk !== undefined &&
    features.attendance_trend_risk > 0
  ) {
    add(
      'Attendance Trend',
      features.attendance_trend_risk >= 50 ? 'HIGH' : 'MEDIUM',
      `Attendance rate changed by ${data.attendance_trend_change.toFixed(1)}% compared with the previous 7-day period.`,
      data.attendance_trend_change
    );
  }

  // Rating
  if (features.rating_risk !== undefined) {
    add(
      'Performance Rating',
      features.rating_risk >= 60
        ? 'HIGH'
        : features.rating_risk >= 25
          ? 'MEDIUM'
          : 'LOW',
      `Average rating ${(data.avg_rating || 0).toFixed(1)}/10 across ${data.ratings_count} evaluation(s).`,
      data.avg_rating
    );
  }

  // Rating trend
  if (
    features.rating_trend_risk !== undefined &&
    features.rating_trend_risk > 0
  ) {
    add(
      'Rating Trend',
      features.rating_trend_risk >= 50 ? 'HIGH' : 'MEDIUM',
      `Performance rating has declined by ${Math.abs(data.rating_trend_change).toFixed(1)} points compared with the beginning of the review period.`,
      data.rating_trend_change
    );
  }

  // Recent activity
  if (
    features.recent_activity_risk !== undefined &&
    features.recent_activity_risk > 20
  ) {
    add(
      'Recent Activity (Last 7 Days)',
      features.recent_activity_risk >= 50 ? 'HIGH' : 'MEDIUM',
      `Only ${data.completed_7d} of ${data.assigned_7d} tasks completed in the last 7 days (${(data.recent_completion_rate || 0).toFixed(1)}% recent rate).`,
      data.recent_completion_rate
    );
  }

  // Sort by impact: HIGH first
  const impactRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  factors.sort(
    (a, b) => (impactRank[a.impact] || 2) - (impactRank[b.impact] || 2)
  );

  return factors.slice(0, 6); // top 6 factors
}

// ---------------------------------------------------------------------------
// Build predictive outcome labels
// ---------------------------------------------------------------------------
function buildPredictions(riskScore, features, data) {
  const predictions = [];

  const add = (type, label, probability, note) => {
    predictions.push({
      type,
      label,
      probability: Math.round(probability * 100) / 100,
      note,
    });
  };

  // Deadline risk prediction
  if (features.deadline_miss_risk !== undefined) {
    const p = features.deadline_miss_risk / 100;
    if (p > 0.2) {
      add(
        'DEADLINE_RISK',
        p >= 0.6
          ? 'High probability of missing upcoming deadlines'
          : 'Elevated risk of deadline miss',
        p,
        `Based on ${(data.deadline_miss_rate || 0).toFixed(1)}% historical deadline miss rate.`
      );
    }
  }

  // Task completion risk
  if (features.completion_risk !== undefined) {
    const p = features.completion_risk / 100;
    if (p > 0.2) {
      add(
        'COMPLETION_RISK',
        p >= 0.6
          ? 'Intern likely to leave tasks incomplete'
          : 'Elevated risk of incomplete task submissions',
        p,
        `Based on ${(data.completion_rate || 0).toFixed(1)}% completion rate.`
      );
    }
  }

  // Attendance risk
  if (features.attendance_risk !== undefined) {
    const p = features.attendance_risk / 100;
    if (p > 0.2) {
      add(
        'ATTENDANCE_RISK',
        p >= 0.6
          ? 'Attendance pattern indicates elevated absence risk'
          : 'Attendance below expected threshold',
        p,
        `Current attendance rate: ${(data.attendance_rate || 0).toFixed(1)}%.`
      );
    }
  }

  // Overall performance risk
  if (riskScore >= 40) {
    const p = riskScore / 100;
    add(
      'PERFORMANCE_RISK',
      riskScore >= 80
        ? 'High probability of performance deterioration in next evaluation period'
        : 'Elevated risk of underperformance',
      p,
      'Composite of attendance, task, and rating signals.'
    );
  }

  return predictions;
}

// ---------------------------------------------------------------------------
// Generate mentor recommendations (signal-grounded, not generic)
// ---------------------------------------------------------------------------
function buildRecommendations(factors, data) {
  const recs = [];

  for (const factor of factors) {
    if (factor.impact === 'HIGH' || factor.impact === 'MEDIUM') {
      switch (factor.factor) {
        case 'Task Completion Rate':
          recs.push({
            action: 'Review assigned task queue and identify blockers.',
            rationale: `Task completion rate is ${(data.completion_rate || 0).toFixed(1)}%. Schedule a check-in to understand what is preventing task completion.`,
          });
          break;
        case 'Deadline Miss Rate':
          recs.push({
            action: 'Review pending tasks and adjust workload or deadlines.',
            rationale: `${data.tasks_late} task(s) submitted after deadline. Clarify expectations and check if workload is appropriate.`,
          });
          break;
        case 'Overdue Tasks':
          recs.push({
            action: 'Review and prioritize overdue task queue with the intern.',
            rationale: `${data.tasks_overdue} task(s) currently past their deadline. Immediate review recommended.`,
          });
          break;
        case 'Attendance Rate':
          recs.push({
            action:
              'Check in with the intern about operational attendance issues.',
            rationale: `Attendance rate of ${(data.attendance_rate || 0).toFixed(1)}% is below the expected threshold. Verify if there are underlying operational issues.`,
          });
          break;
        case 'Consecutive Absences':
          recs.push({
            action: 'Reach out to verify intern status and availability.',
            rationale: `${data.absence_streak} consecutive absent days detected. Proactive outreach recommended.`,
          });
          break;
        case 'Performance Rating':
          recs.push({
            action: 'Schedule a performance review session.',
            rationale: `Average rating of ${(data.avg_rating || 0).toFixed(1)}/10 is below the expected threshold. A structured feedback session may help.`,
          });
          break;
        case 'Rating Trend':
          recs.push({
            action:
              'Compare recent work quality against previous evaluation period.',
            rationale: `Rating has declined by ${Math.abs(data.rating_trend_change).toFixed(1)} points. Review recent output quality.`,
          });
          break;
        default:
          break;
      }
    }
  }

  // De-duplicate
  const seen = new Set();
  return recs.filter((r) => {
    if (seen.has(r.action)) return false;
    seen.add(r.action);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Determine trend direction
// ---------------------------------------------------------------------------
function computeTrend(currentRisk, previousRisk) {
  if (previousRisk === null) return { direction: 'stable', change: 0 };
  const change = currentRisk - previousRisk;
  let direction;
  if (change >= 20) direction = 'rapidly_worsening';
  else if (change >= 8) direction = 'worsening';
  else if (change <= -8) direction = 'improving';
  else direction = 'stable';
  return { direction, change: Math.round(change * 10) / 10 };
}

// ---------------------------------------------------------------------------
// Main: compute risk for one intern and save
// ---------------------------------------------------------------------------
async function computeAndSaveRisk(internId, periodDays = 30) {
  // 1. Gather raw operational signals
  const data = await riskRepo.gatherRiskFeatures(internId, periodDays);

  // 2. Engineer features
  const { features, signalCount } = engineerFeatures(data);

  // 3. Check data sufficiency
  const dataQuality = riskRepo.classifyDataQuality(signalCount);
  const hasEnoughData =
    data.tasks_assigned >= THRESHOLDS.min_tasks_for_confidence ||
    data.attendance_total_marked >= THRESHOLDS.min_attendance_for_confidence ||
    data.ratings_count >= 1;

  if (!hasEnoughData) {
    // Insufficient data — save a minimal record
    const result = await riskRepo.saveRiskScore({
      intern_id: internId,
      risk_score: 0,
      risk_level: 'VERY_LOW',
      performance_score: 0,
      performance_level: 'Insufficient Data',
      confidence: 0.2,
      data_quality: 'INSUFFICIENT',
      trend_direction: 'insufficient_data',
      trend_change: 0,
      previous_risk_score: null,
      factors: [],
      predictions: [],
      feature_snapshot: {
        insufficient_data: true,
        intern_age_days: data.intern_age_days,
      },
      signal_count: signalCount,
      attendance_days: data.attendance_total_marked,
      tasks_assigned: data.tasks_assigned,
      ratings_count: data.ratings_count,
      model_version: 'v1.0-deterministic',
      period_start: new Date(Date.now() - periodDays * 86400000).toISOString(),
      period_end: new Date().toISOString(),
    });
    return result;
  }

  // 4. Compute risk score
  const riskScore = computeRiskScore(features);
  const riskLevel = riskRepo.classifyRisk(riskScore);
  const confidence = computeConfidence(signalCount, data.intern_age_days);

  // 5. Compute inverse performance score (higher risk = lower performance)
  const performanceScore = Math.round(100 - riskScore * 0.7);
  let performanceLevel = 'Satisfactory';
  if (performanceScore >= 88) performanceLevel = 'Exceptional';
  else if (performanceScore >= 75) performanceLevel = 'Good';
  else if (performanceScore < 50) performanceLevel = 'Needs Improvement';
  else if (performanceScore < 35) performanceLevel = 'At Risk';

  // 6. Explainability
  const factors = buildFactors(features, data);
  const predictions = buildPredictions(riskScore, features, data);

  // 7. Trend
  const previousRiskScore = data.previous_risk
    ? Number(data.previous_risk.risk_score)
    : null;
  const { direction: trendDirection, change: trendChange } = computeTrend(
    riskScore,
    previousRiskScore
  );

  // 8. Feature snapshot (structured, no PII — intern ID only as reference)
  const featureSnapshot = {
    tasks_assigned: data.tasks_assigned,
    completion_rate: data.completion_rate,
    deadline_miss_rate: data.deadline_miss_rate,
    tasks_overdue: data.tasks_overdue,
    attendance_rate: data.attendance_rate,
    absence_streak: data.absence_streak,
    avg_rating: data.avg_rating,
    rating_trend_change: data.rating_trend_change,
    signal_count: signalCount,
    ...features,
  };

  // 9. Save risk snapshot
  const savedRecord = await riskRepo.saveRiskScore({
    intern_id: internId,
    risk_score: riskScore,
    risk_level: riskLevel,
    performance_score: performanceScore,
    performance_level: performanceLevel,
    confidence,
    data_quality: dataQuality,
    trend_direction: trendDirection,
    trend_change: trendChange,
    previous_risk_score: previousRiskScore,
    factors,
    predictions,
    feature_snapshot: featureSnapshot,
    signal_count: signalCount,
    attendance_days: data.attendance_total_marked,
    tasks_assigned: data.tasks_assigned,
    ratings_count: data.ratings_count,
    model_version: 'v1.0-deterministic',
    period_start: new Date(Date.now() - periodDays * 86400000).toISOString(),
    period_end: new Date().toISOString(),
  });

  // 10. Build recommendations (returned to caller — alert service will use them)
  const recommendations = buildRecommendations(factors, data);

  return {
    ...savedRecord,
    recommendations,
    raw_features: features,
  };
}

module.exports = {
  computeAndSaveRisk,
  buildFactors,
  buildPredictions,
  buildRecommendations,
  computeRiskScore,
  engineerFeatures,
  THRESHOLDS,
};
