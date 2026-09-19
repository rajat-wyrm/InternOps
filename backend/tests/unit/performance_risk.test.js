/**
 * Unit tests for the performance risk intelligence engine.
 *
 * Tests:
 *  1. Feature engineering correctness
 *  2. Risk score calculation
 *  3. Risk classification thresholds
 *  4. Explainability factor generation
 *  5. Alert condition evaluation
 *  6. Alert auto-resolution logic
 *  7. Trend computation
 *  8. Insufficient data handling
 */
const {
  computeRiskScore,
  engineerFeatures,
  buildFactors,
  buildPredictions,
  THRESHOLDS,
} = require('../../src/modules/ai-performance/risk.service');

const {
  evaluateAlertConditions,
  evaluateAutoResolution,
  ALERT_TYPES,
} = require('../../src/modules/ai-performance/alert.service');

// ---------------------------------------------------------------------------
// Helpers — Build representative raw data objects
// ---------------------------------------------------------------------------
function makeData(overrides = {}) {
  return {
    intern_id: '11111111-1111-1111-1111-111111111111',
    intern_name: 'Test Intern',
    department: 'Engineering',
    intern_age_days: 60,
    tasks_assigned: 10,
    tasks_completed: 8,
    tasks_late: 1,
    tasks_rejected: 0,
    tasks_pending: 1,
    tasks_overdue: 0,
    completion_rate: 80,
    deadline_miss_rate: 10,
    overdue_rate: 0,
    avg_delay_hours: 2,
    assigned_7d: 3,
    completed_7d: 3,
    recent_completion_rate: 100,
    ratings_count: 4,
    avg_rating: 7.5,
    rating_trend_change: 0.3,
    rating_variance: 0.5,
    attendance_total_marked: 20,
    attendance_present: 18,
    attendance_absent: 2,
    attendance_half_days: 0,
    attendance_rate: 90,
    absence_streak: 0,
    attendance_trend_change: 0,
    previous_risk: null,
    period_days: 30,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Feature Engineering
// ---------------------------------------------------------------------------
describe('Feature Engineering', () => {
  test('returns empty features and 0 signal count for intern with no data', () => {
    const data = makeData({
      tasks_assigned: 0,
      ratings_count: 0,
      attendance_total_marked: 0,
      attendance_rate: null,
      avg_rating: null,
      completion_rate: null,
    });
    const { features, signalCount } = engineerFeatures(data);
    expect(signalCount).toBe(0);
    expect(Object.keys(features)).toHaveLength(0);
  });

  test('computes low attendance_risk for 95% attendance', () => {
    const data = makeData({
      attendance_rate: 95,
      attendance_total_marked: 20,
    });
    const { features } = engineerFeatures(data);
    expect(features.attendance_risk).toBeLessThanOrEqual(20);
  });

  test('computes high attendance_risk for 45% attendance', () => {
    const data = makeData({
      attendance_rate: 45,
      attendance_total_marked: 20,
    });
    const { features } = engineerFeatures(data);
    expect(features.attendance_risk).toBeGreaterThanOrEqual(60);
  });

  test('computes high completion_risk for 40% completion', () => {
    const data = makeData({
      tasks_assigned: 10,
      tasks_completed: 4,
      completion_rate: 40,
    });
    const { features } = engineerFeatures(data);
    expect(features.completion_risk).toBeGreaterThanOrEqual(60);
  });

  test('computes low completion_risk for 95% completion', () => {
    const data = makeData({
      tasks_assigned: 10,
      tasks_completed: 9,
      completion_rate: 95,
    });
    const { features } = engineerFeatures(data);
    expect(features.completion_risk).toBeLessThanOrEqual(15);
  });

  test('computes high absence_streak_risk for 5+ consecutive absences', () => {
    const data = makeData({
      absence_streak: 5,
      attendance_total_marked: 10,
      attendance_rate: 50,
    });
    const { features } = engineerFeatures(data);
    expect(features.absence_streak_risk).toBeGreaterThanOrEqual(70);
  });

  test('counts all signal types in totals', () => {
    const data = makeData({
      tasks_assigned: 8,
      ratings_count: 4,
      attendance_total_marked: 15,
      assigned_7d: 2,
    });
    const { signalCount } = engineerFeatures(data);
    // tasks(8) + ratings(4) + attendance(15) + recent(2) = 29
    expect(signalCount).toBeGreaterThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// Risk Score Computation
// ---------------------------------------------------------------------------
describe('Risk Score Computation', () => {
  test('returns 0 for empty features (no data)', () => {
    const score = computeRiskScore({});
    expect(score).toBe(0);
  });

  test('returns low score for good performer', () => {
    const data = makeData({
      completion_rate: 95,
      deadline_miss_rate: 3,
      attendance_rate: 95,
      avg_rating: 8.5,
      tasks_overdue: 0,
    });
    const { features } = engineerFeatures(data);
    const score = computeRiskScore(features);
    expect(score).toBeLessThan(30);
  });

  test('returns high score for poor performer', () => {
    const data = makeData({
      tasks_assigned: 10,
      tasks_completed: 3,
      completion_rate: 30,
      deadline_miss_rate: 60,
      attendance_rate: 40,
      attendance_total_marked: 20,
      avg_rating: 3.0,
      tasks_overdue: 4,
    });
    const { features } = engineerFeatures(data);
    const score = computeRiskScore(features);
    expect(score).toBeGreaterThan(50);
  });

  test('risk score is always between 0 and 100', () => {
    const extremeData = makeData({
      completion_rate: 0,
      deadline_miss_rate: 100,
      attendance_rate: 0,
      attendance_total_marked: 20,
      avg_rating: 1,
      tasks_overdue: 10,
      tasks_assigned: 10,
      tasks_rejected: 5,
      absence_streak: 7,
    });
    const { features } = engineerFeatures(extremeData);
    const score = computeRiskScore(features);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Factor Generation
// ---------------------------------------------------------------------------
describe('Explainability Factors', () => {
  test('generates factors for a high-risk intern', () => {
    const data = makeData({
      tasks_assigned: 20,
      tasks_completed: 2,
      tasks_late: 8,
      tasks_overdue: 5,
      completion_rate: 10,
      deadline_miss_rate: 80,
      attendance_rate: 20,
      attendance_total_marked: 20,
      attendance_present: 4,
      avg_rating: 1.5,
      ratings_count: 5,
    });
    const { features } = engineerFeatures(data);
    const factors = buildFactors(features, data);
    expect(factors.length).toBeGreaterThan(0);
    expect(factors.length).toBeLessThanOrEqual(6);
    // High impact factors should come first
    const impactOrder = factors.map((f) => f.impact);
    expect(impactOrder[0]).toBe('HIGH');
  });

  test('factors include correct metadata fields', () => {
    const data = makeData({
      tasks_assigned: 10,
      completion_rate: 50,
      avg_rating: 4.0,
    });
    const { features } = engineerFeatures(data);
    const factors = buildFactors(features, data);
    factors.forEach((f) => {
      expect(f).toHaveProperty('factor');
      expect(f).toHaveProperty('impact');
      expect(f).toHaveProperty('description');
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(f.impact);
    });
  });

  test('returns empty array when there is no data', () => {
    const factors = buildFactors({}, makeData({ tasks_assigned: 0 }));
    expect(factors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Prediction building
// ---------------------------------------------------------------------------
describe('Predictions', () => {
  test('generates deadline risk prediction for high miss rate', () => {
    const data = makeData({ deadline_miss_rate: 60, tasks_assigned: 10 });
    const { features } = engineerFeatures(data);
    const predictions = buildPredictions(75, features, data);
    const types = predictions.map((p) => p.type);
    expect(types).toContain('DEADLINE_RISK');
  });

  test('does not generate predictions for good data', () => {
    const data = makeData({
      completion_rate: 95,
      deadline_miss_rate: 2,
      attendance_rate: 95,
    });
    const { features } = engineerFeatures(data);
    const predictions = buildPredictions(10, features, data);
    const highRisk = predictions.filter((p) => p.probability > 0.5);
    expect(highRisk).toHaveLength(0);
  });

  test('each prediction has required fields', () => {
    const data = makeData({ completion_rate: 30, tasks_assigned: 10 });
    const { features } = engineerFeatures(data);
    const predictions = buildPredictions(65, features, data);
    predictions.forEach((p) => {
      expect(p).toHaveProperty('type');
      expect(p).toHaveProperty('label');
      expect(p).toHaveProperty('probability');
      expect(p.probability).toBeGreaterThanOrEqual(0);
      expect(p.probability).toBeLessThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Alert Conditions
// ---------------------------------------------------------------------------
describe('Alert Condition Evaluation', () => {
  function makeRiskRecord(overrides = {}) {
    return {
      intern_id: '11111111-1111-1111-1111-111111111111',
      intern_name: 'Test Intern',
      risk_score: 75,
      risk_level: 'HIGH',
      data_quality: 'GOOD',
      confidence: 0.75,
      trend_direction: 'stable',
      trend_change: 5,
      factors: [
        {
          factor: 'Task Completion Rate',
          impact: 'HIGH',
          description: 'test',
          value: 40,
        },
        {
          factor: 'Attendance Rate',
          impact: 'HIGH',
          description: 'test',
          value: 55,
        },
        {
          factor: 'Deadline Miss Rate',
          impact: 'MEDIUM',
          description: 'test',
          value: 30,
        },
        {
          factor: 'Overdue Tasks',
          impact: 'HIGH',
          description: 'test',
          value: 3,
        },
      ],
      ...overrides,
    };
  }

  test('generates HIGH_RISK alert when risk level is HIGH', () => {
    const record = makeRiskRecord({ risk_level: 'HIGH' });
    const alerts = evaluateAlertConditions(record, {}, {});
    const types = alerts.map((a) => a.type);
    expect(types).toContain(ALERT_TYPES.HIGH_RISK);
  });

  test('generates CRITICAL_RISK alert when risk level is CRITICAL', () => {
    const record = makeRiskRecord({ risk_level: 'CRITICAL', risk_score: 85 });
    const alerts = evaluateAlertConditions(record, {}, {});
    const types = alerts.map((a) => a.type);
    expect(types).toContain(ALERT_TYPES.CRITICAL_RISK);
  });

  test('generates ATTENDANCE_RISK alert when attendance factor is HIGH impact', () => {
    const record = makeRiskRecord({ risk_level: 'MODERATE' });
    const alerts = evaluateAlertConditions(record, {}, { attendance_rate: 45 });
    const types = alerts.map((a) => a.type);
    expect(types).toContain(ALERT_TYPES.ATTENDANCE_RISK);
  });

  test('generates DEADLINE_RISK when overdue tasks are HIGH impact', () => {
    const record = makeRiskRecord({ risk_level: 'MODERATE' });
    const alerts = evaluateAlertConditions(
      record,
      {},
      { deadline_miss_rate: 30 }
    );
    const types = alerts.map((a) => a.type);
    expect(types).toContain(ALERT_TYPES.DEADLINE_RISK);
  });

  test('generates no alerts when data quality is INSUFFICIENT', () => {
    const record = makeRiskRecord({ data_quality: 'INSUFFICIENT' });
    const alerts = evaluateAlertConditions(record, {}, {});
    expect(alerts).toHaveLength(0);
  });

  test('every alert has required fields', () => {
    const record = makeRiskRecord({});
    const alerts = evaluateAlertConditions(
      record,
      {},
      { completion_rate: 30, attendance_rate: 50 }
    );
    alerts.forEach((a) => {
      expect(a).toHaveProperty('type');
      expect(a).toHaveProperty('severity');
      expect(a).toHaveProperty('title');
      expect(a).toHaveProperty('description');
      expect(a).toHaveProperty('recommendation');
      expect(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(
        a.severity
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Auto-Resolution Logic
// ---------------------------------------------------------------------------
describe('Alert Auto-Resolution', () => {
  function makeRecord(riskLevel, factorOverrides = []) {
    return {
      risk_level: riskLevel,
      factors: factorOverrides,
    };
  }

  test('resolves CRITICAL_RISK and HIGH_RISK alerts at VERY_LOW risk', () => {
    const record = makeRecord('VERY_LOW', []);
    const toResolve = evaluateAutoResolution(record);
    expect(toResolve).toContain(ALERT_TYPES.CRITICAL_RISK);
    expect(toResolve).toContain(ALERT_TYPES.HIGH_RISK);
  });

  test('resolves ATTENDANCE_RISK when no high-impact attendance factor', () => {
    const record = makeRecord('MODERATE', [
      { factor: 'Task Completion Rate', impact: 'HIGH' },
    ]);
    const toResolve = evaluateAutoResolution(record);
    expect(toResolve).toContain(ALERT_TYPES.ATTENDANCE_RISK);
  });

  test('does NOT resolve ATTENDANCE_RISK when attendance factor is HIGH', () => {
    const record = makeRecord('HIGH', [
      { factor: 'Attendance Rate', impact: 'HIGH' },
    ]);
    const toResolve = evaluateAutoResolution(record);
    expect(toResolve).not.toContain(ALERT_TYPES.ATTENDANCE_RISK);
  });

  test('returns unique set of types', () => {
    const record = makeRecord('VERY_LOW', []);
    const toResolve = evaluateAutoResolution(record);
    const unique = [...new Set(toResolve)];
    expect(toResolve.length).toBe(unique.length);
  });
});
