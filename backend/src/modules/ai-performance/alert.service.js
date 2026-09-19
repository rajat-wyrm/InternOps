/**
 * alert.service.js
 *
 * Proactive alert engine.
 * Evaluates a computed risk record and generates/updates/resolves alerts.
 * Integrates with the notifications system for real-time mentor notification.
 */
const alertRepo = require('./alert.repository');
const notificationsRepo = require('../notifications/repository');
const auditRepo = require('../audit/repository');
const pool = require('../../config/db');

// ---------------------------------------------------------------------------
// Alert type definitions
// ---------------------------------------------------------------------------
const ALERT_TYPES = {
  CRITICAL_RISK: 'CRITICAL_RISK',
  HIGH_RISK: 'HIGH_RISK',
  ATTENDANCE_RISK: 'ATTENDANCE_RISK',
  DEADLINE_RISK: 'DEADLINE_RISK',
  TASK_COMPLETION_RISK: 'TASK_COMPLETION_RISK',
  PERFORMANCE_DECLINE: 'PERFORMANCE_DECLINE',
};

// ---------------------------------------------------------------------------
// Determine which alerts should fire based on a computed risk profile
// Each entry: { type, severity, title, description, recommendation, factors }
// ---------------------------------------------------------------------------
function evaluateAlertConditions(riskRecord, rawFeatures, rawData) {
  const alerts = [];
  const riskScore = riskRecord.risk_score || 0;
  const isInsufficient = riskRecord.data_quality === 'INSUFFICIENT';

  if (isInsufficient) return alerts; // No alerts without data

  const factors = riskRecord.factors || [];

  // 1. Critical overall risk
  if (riskRecord.risk_level === 'CRITICAL') {
    alerts.push({
      type: ALERT_TYPES.CRITICAL_RISK,
      severity: 'CRITICAL',
      title: `⚠️ Critical Performance Risk: ${riskRecord.intern_name || 'Intern'}`,
      description: `Risk score has reached ${riskScore}/100 (Critical). Multiple performance signals indicate urgent attention is needed.`,
      recommendation:
        'Immediate mentor review recommended. Schedule a 1:1 session and review assigned workload, attendance, and task completion patterns.',
      factors: factors.filter((f) => f.impact === 'HIGH').slice(0, 3),
    });
  }

  // 2. High risk
  if (riskRecord.risk_level === 'HIGH') {
    alerts.push({
      type: ALERT_TYPES.HIGH_RISK,
      severity: 'HIGH',
      title: `High Performance Risk Detected`,
      description: `Risk score is ${riskScore}/100 (High). Performance signals suggest the intern needs support.`,
      recommendation:
        'Schedule a check-in with the intern and review their current workload and task progress.',
      factors: factors.slice(0, 3),
    });
  }

  // 3. Attendance risk
  const attendanceFactor = factors.find((f) => f.factor === 'Attendance Rate');
  const streakFactor = factors.find((f) => f.factor === 'Consecutive Absences');
  const attendanceTrendFactor = factors.find(
    (f) => f.factor === 'Attendance Trend'
  );

  if (
    (attendanceFactor && attendanceFactor.impact === 'HIGH') ||
    (streakFactor && streakFactor.impact === 'HIGH')
  ) {
    const streakVal = streakFactor ? streakFactor.value : 0;
    alerts.push({
      type: ALERT_TYPES.ATTENDANCE_RISK,
      severity: streakVal >= 5 ? 'HIGH' : 'MEDIUM',
      title: 'Attendance Risk Detected',
      description:
        streakVal >= 3
          ? `${streakVal} consecutive absent days detected. Attendance pattern requires attention.`
          : `Attendance rate has fallen below the expected threshold (${(rawData?.attendance_rate || 0).toFixed(1)}%).`,
      recommendation:
        'Check in with the intern to verify operational availability and address any issues affecting attendance.',
      factors: [attendanceFactor, streakFactor, attendanceTrendFactor].filter(
        Boolean
      ),
    });
  }

  // 4. Deadline risk
  const deadlineFactor = factors.find((f) => f.factor === 'Deadline Miss Rate');
  const overdueFactor = factors.find((f) => f.factor === 'Overdue Tasks');

  if (
    (deadlineFactor &&
      (deadlineFactor.impact === 'HIGH' ||
        deadlineFactor.impact === 'MEDIUM')) ||
    (overdueFactor && overdueFactor.impact === 'HIGH')
  ) {
    alerts.push({
      type: ALERT_TYPES.DEADLINE_RISK,
      severity: deadlineFactor?.impact === 'HIGH' ? 'HIGH' : 'MEDIUM',
      title: 'Deadline Risk Detected',
      description: overdueFactor
        ? `${overdueFactor.value} task(s) currently overdue. Deadline adherence is a concern.`
        : `${(rawData?.deadline_miss_rate || 0).toFixed(1)}% of tasks were completed after their deadline.`,
      recommendation:
        "Review the intern's pending task queue. Consider adjusting workload or providing additional clarification on task requirements.",
      factors: [deadlineFactor, overdueFactor].filter(Boolean),
    });
  }

  // 5. Task completion risk
  const completionFactor = factors.find(
    (f) => f.factor === 'Task Completion Rate'
  );
  const recentActivityFactor = factors.find(
    (f) => f.factor === 'Recent Activity (Last 7 Days)'
  );

  if (
    (completionFactor && completionFactor.impact === 'HIGH') ||
    (recentActivityFactor && recentActivityFactor.impact === 'HIGH')
  ) {
    alerts.push({
      type: ALERT_TYPES.TASK_COMPLETION_RISK,
      severity: completionFactor?.impact === 'HIGH' ? 'HIGH' : 'MEDIUM',
      title: 'Task Completion Risk Detected',
      description: `Task completion rate is ${(rawData?.completion_rate || 0).toFixed(1)}%, significantly below the expected threshold.`,
      recommendation:
        'Review any task assignment blockers. Check whether tasks are clearly defined and appropriate for current skill level.',
      factors: [completionFactor, recentActivityFactor].filter(Boolean),
    });
  }

  // 6. Performance decline
  const ratingTrendFactor = factors.find((f) => f.factor === 'Rating Trend');
  if (
    ratingTrendFactor &&
    ratingTrendFactor.impact === 'HIGH' &&
    riskRecord.trend_direction === 'worsening'
  ) {
    alerts.push({
      type: ALERT_TYPES.PERFORMANCE_DECLINE,
      severity: 'MEDIUM',
      title: 'Performance Trend Declining',
      description: `Rating has declined by ${Math.abs(rawData?.rating_trend_change || 0).toFixed(1)} points and the overall risk score has increased by ${Math.abs(riskRecord.trend_change || 0)} points.`,
      recommendation:
        'Schedule a mentor review and compare recent work output against the previous evaluation period.',
      factors: [ratingTrendFactor].filter(Boolean),
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Determine which alert types should be auto-resolved
// (i.e., risk has returned to acceptable level)
// ---------------------------------------------------------------------------
function evaluateAutoResolution(riskRecord) {
  const toResolve = [];
  const riskLevel = riskRecord.risk_level;

  if (riskLevel === 'VERY_LOW' || riskLevel === 'LOW') {
    toResolve.push(ALERT_TYPES.CRITICAL_RISK, ALERT_TYPES.HIGH_RISK);
  }

  const factors = riskRecord.factors || [];
  const attendanceFactor = factors.find((f) => f.factor === 'Attendance Rate');
  if (!attendanceFactor || attendanceFactor.impact === 'LOW') {
    toResolve.push(ALERT_TYPES.ATTENDANCE_RISK);
  }

  const deadlineFactor = factors.find((f) => f.factor === 'Deadline Miss Rate');
  if (!deadlineFactor || deadlineFactor.impact === 'LOW') {
    toResolve.push(ALERT_TYPES.DEADLINE_RISK);
  }

  const completionFactor = factors.find(
    (f) => f.factor === 'Task Completion Rate'
  );
  if (!completionFactor || completionFactor.impact === 'LOW') {
    toResolve.push(ALERT_TYPES.TASK_COMPLETION_RISK);
  }

  return [...new Set(toResolve)];
}

// ---------------------------------------------------------------------------
// Get the intern's manager (for notification target)
// ---------------------------------------------------------------------------
async function getInternManager(internId) {
  const res = await pool.query(
    `SELECT u.manager_id, m.full_name AS manager_name, m.id AS manager_id_val
     FROM users u
     LEFT JOIN users m ON m.id = u.manager_id AND m.deleted_at IS NULL
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [internId]
  );
  return res.rows[0] || null;
}

// ---------------------------------------------------------------------------
// Main: process risk record → generate/update/resolve alerts + notifications
// ---------------------------------------------------------------------------
async function processRiskAlerts(riskRecord, rawFeatures = {}, rawData = {}) {
  const internId = riskRecord.intern_id;
  const internName = rawData?.intern_name || riskRecord.full_name || 'Intern';
  const results = { created: [], escalated: [], resolved: [] };

  try {
    // 1. Auto-resolve alerts that no longer apply
    const toResolve = evaluateAutoResolution(riskRecord);
    if (toResolve.length > 0) {
      const resolved = await alertRepo.autoResolveAlerts(
        internId,
        toResolve,
        `Risk level returned to ${riskRecord.risk_level}.`
      );
      results.resolved = resolved;
    }

    // 2. Evaluate which alerts should fire
    const alertConditions = evaluateAlertConditions(
      riskRecord,
      rawFeatures,
      rawData
    );

    // 3. Upsert each alert (deduplication built into alertRepo)
    const internManager = await getInternManager(internId);

    for (const alertDef of alertConditions) {
      try {
        const { alert, eventType, isNew } = await alertRepo.upsertAlert({
          internId,
          alertType: alertDef.type,
          severity: alertDef.severity,
          title: alertDef.title,
          description: alertDef.description,
          recommendation: alertDef.recommendation,
          factors: alertDef.factors,
          riskScore: riskRecord.risk_score,
          confidence: riskRecord.confidence,
        });

        // 4. Notify senior managers only on NEW alerts (not retriggered ones)
        if (isNew || eventType === 'SEVERITY_ESCALATED') {
          const notifyMessage = `⚠️ AI Risk Alert [${alertDef.severity}]: ${alertDef.title} — ${alertDef.description.slice(0, 150)}`;

          // Notify the intern's direct manager
          if (internManager?.manager_id_val) {
            try {
              await notificationsRepo.send(
                internManager.manager_id_val,
                notifyMessage
              );
            } catch (notifyErr) {
              console.warn(
                '[Alert Service] Manager notification failed:',
                notifyErr.message
              );
            }
          }

          // For CRITICAL alerts, also notify admins
          if (alertDef.severity === 'CRITICAL') {
            try {
              await notificationsRepo.notifyAdmin(notifyMessage);
            } catch (notifyErr) {
              console.warn(
                '[Alert Service] Admin notification failed:',
                notifyErr.message
              );
            }
          }

          // Audit log
          await auditRepo.logEvent({
            userId: internId,
            action: 'PERF_ALERT_CREATED',
            resourceType: 'performance_alert',
            resourceId: alert.id,
            details: {
              alert_type: alertDef.type,
              severity: alertDef.severity,
              intern_id: internId,
              risk_score: riskRecord.risk_score,
            },
          });
        }

        if (eventType === 'CREATED' || eventType === 'SEVERITY_ESCALATED') {
          results.created.push(alert);
        } else {
          results.escalated.push(alert);
        }
      } catch (alertErr) {
        console.error(
          '[Alert Service] Failed to upsert alert:',
          alertErr.message
        );
      }
    }
  } catch (err) {
    console.error('[Alert Service] processRiskAlerts failed:', err.message);
  }

  return results;
}

module.exports = {
  processRiskAlerts,
  evaluateAlertConditions,
  evaluateAutoResolution,
  ALERT_TYPES,
};
