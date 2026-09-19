/**
 * risk.repository.js
 *
 * Database operations for performance_risk_scores.
 * Handles insert/upsert of risk snapshots and dashboard queries.
 */
const pool = require('../../config/db');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RISK_LEVELS = ['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'];

function classifyRisk(score) {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MODERATE';
  if (score >= 20) return 'LOW';
  return 'VERY_LOW';
}

function classifyDataQuality(signalCount) {
  if (signalCount >= 30) return 'HIGH';
  if (signalCount >= 15) return 'GOOD';
  if (signalCount >= 5) return 'MODERATE';
  if (signalCount >= 1) return 'LIMITED';
  return 'INSUFFICIENT';
}

// ---------------------------------------------------------------------------
// Gather raw operational data for a single intern
// Reuses patterns from existing ai-performance repository but adds more signals
// ---------------------------------------------------------------------------
async function gatherRiskFeatures(internId, periodDays = 30) {
  const endIso = new Date().toISOString();
  const startIso = new Date(Date.now() - periodDays * 86400000).toISOString();
  const start14Iso = new Date(Date.now() - 14 * 86400000).toISOString();
  const start7Iso = new Date(Date.now() - 7 * 86400000).toISOString();

  // 1. Intern info
  const userRes = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.role, u.department_id, u.created_at,
            d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [internId]
  );
  if (userRes.rows.length === 0) {
    throw Object.assign(new Error('Intern not found'), { statusCode: 404 });
  }
  const intern = userRes.rows[0];
  const internAgeDays = Math.floor(
    (Date.now() - new Date(intern.created_at).getTime()) / 86400000
  );

  // 2. Task signals (30-day window)
  const taskRes = await pool.query(
    `SELECT t.id, t.deadline, t.created_at AS task_created,
            p.status AS proof_status,
            p.created_at AS submitted_at,
            p.verified_at
     FROM task_assignments ta
     JOIN social_tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
     LEFT JOIN proof_submissions p
       ON p.task_id = t.id AND p.intern_id = ta.user_id AND p.deleted_at IS NULL
     WHERE ta.user_id = $1 AND ta.deleted_at IS NULL
       AND t.created_at >= $2::timestamptz`,
    [internId, startIso]
  );

  let tasksAssigned = taskRes.rows.length;
  let tasksCompleted = 0;
  let tasksLate = 0;
  let tasksRejected = 0;
  let tasksPending = 0;
  let tasksOverdue = 0;
  let totalDelayMs = 0;
  let delayedCount = 0;
  const now = new Date();

  for (const row of taskRes.rows) {
    const isApproved =
      row.proof_status === 'APPROVED' || row.proof_status === 'VERIFIED';
    const isRejected = row.proof_status === 'REJECTED';
    const isPending = !row.proof_status || row.proof_status === 'PENDING';
    const hasDeadline = !!row.deadline;
    const deadlineDate = hasDeadline ? new Date(row.deadline) : null;
    const isOverdue = hasDeadline && deadlineDate < now && !isApproved;

    if (isApproved) {
      tasksCompleted++;
      if (
        hasDeadline &&
        row.submitted_at &&
        new Date(row.submitted_at) > deadlineDate
      ) {
        tasksLate++;
        const delay = new Date(row.submitted_at) - deadlineDate;
        totalDelayMs += delay;
        delayedCount++;
      }
    } else if (isRejected) {
      tasksRejected++;
    } else if (isPending) {
      tasksPending++;
      if (isOverdue) tasksOverdue++;
    }
  }

  const completionRate =
    tasksAssigned > 0 ? (tasksCompleted / tasksAssigned) * 100 : null;
  const deadlineMissRate =
    tasksAssigned > 0 ? (tasksLate / tasksAssigned) * 100 : null;
  const overdueRate =
    tasksAssigned > 0 ? (tasksOverdue / tasksAssigned) * 100 : null;
  const avgDelayHours =
    delayedCount > 0 ? totalDelayMs / delayedCount / 3600000 : 0;

  // 3. Task signals (7-day window for recency)
  const recentTaskRes = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE p.status IN ('APPROVED','VERIFIED')) AS completed_7d,
            COUNT(*) AS assigned_7d
     FROM task_assignments ta
     JOIN social_tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
     LEFT JOIN proof_submissions p ON p.task_id = t.id AND p.intern_id = ta.user_id AND p.deleted_at IS NULL
     WHERE ta.user_id = $1 AND ta.deleted_at IS NULL AND t.created_at >= $2::timestamptz`,
    [internId, start7Iso]
  );
  const assigned7d = Number(recentTaskRes.rows[0].assigned_7d || 0);
  const completed7d = Number(recentTaskRes.rows[0].completed_7d || 0);
  const recentCompletionRate =
    assigned7d > 0 ? (completed7d / assigned7d) * 100 : null;

  // 4. Rating signals
  const ratingRes = await pool.query(
    `SELECT score, created_at FROM ratings
     WHERE rated_user_id = $1 AND deleted_at IS NULL AND created_at >= $2::timestamptz
     ORDER BY created_at ASC`,
    [internId, startIso]
  );
  const ratings = ratingRes.rows.map((r) => Number(r.score));
  const ratingsCount = ratings.length;
  const avgRating =
    ratingsCount > 0 ? ratings.reduce((a, b) => a + b, 0) / ratingsCount : null;

  // Rating trend: compare first half vs second half
  let ratingTrendChange = 0;
  if (ratingsCount >= 4) {
    const mid = Math.floor(ratingsCount / 2);
    const firstHalfAvg = ratings.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const secondHalfAvg =
      ratings.slice(mid).reduce((a, b) => a + b, 0) / (ratingsCount - mid);
    ratingTrendChange = secondHalfAvg - firstHalfAvg;
  }

  // Rating variance (consistency)
  let ratingVariance = 0;
  if (ratingsCount >= 2) {
    const mean = avgRating;
    ratingVariance =
      ratings.reduce((s, r) => s + (r - mean) ** 2, 0) / ratingsCount;
  }

  // 5. Attendance signals
  const attendanceRes = await pool.query(
    `SELECT status, date FROM attendance
     WHERE user_id = $1 AND deleted_at IS NULL
       AND date >= $2::date AND date <= $3::date
     ORDER BY date DESC`,
    [internId, startIso.slice(0, 10), endIso.slice(0, 10)]
  );
  const attendanceRows = attendanceRes.rows;
  const totalMarked = attendanceRows.length;
  const presentDays = attendanceRows.filter(
    (r) => r.status === 'PRESENT'
  ).length;
  const absentDays = attendanceRows.filter((r) => r.status === 'ABSENT').length;
  const halfDays = attendanceRows.filter((r) => r.status === 'HALF_DAY').length;
  const attendanceRate =
    totalMarked > 0 ? (presentDays / totalMarked) * 100 : null;

  // Consecutive absence streak
  let absenceStreak = 0;
  for (const row of attendanceRows) {
    if (row.status === 'ABSENT') absenceStreak++;
    else break;
  }

  // Attendance trend: compare last 7d vs prior 7d
  const attendanceRes14 = await pool.query(
    `SELECT status FROM attendance
     WHERE user_id = $1 AND deleted_at IS NULL AND date >= $2::date AND date < $3::date`,
    [internId, start14Iso.slice(0, 10), start7Iso.slice(0, 10)]
  );
  const prior14Present = attendanceRes14.rows.filter(
    (r) => r.status === 'PRESENT'
  ).length;
  const prior14Total = attendanceRes14.rows.length;

  const recent7Present = attendanceRows
    .filter((r) => new Date(r.date) >= new Date(start7Iso))
    .filter((r) => r.status === 'PRESENT').length;
  const recent7Total = attendanceRows.filter(
    (r) => new Date(r.date) >= new Date(start7Iso)
  ).length;

  const attendanceTrendChange =
    prior14Total > 0 && recent7Total > 0
      ? (recent7Present / recent7Total - prior14Present / prior14Total) * 100
      : 0;

  // 6. Previous risk score (for trend comparison)
  const prevRiskRes = await pool.query(
    `SELECT risk_score, performance_score, computed_at
     FROM performance_risk_scores
     WHERE intern_id = $1 AND is_latest = FALSE
     ORDER BY computed_at DESC LIMIT 1`,
    [internId]
  );
  const previousRisk = prevRiskRes.rows[0] || null;

  return {
    intern_id: internId,
    intern_name: intern.full_name || intern.email,
    department: intern.department_name || 'General',
    intern_age_days: internAgeDays,

    // Task
    tasks_assigned: tasksAssigned,
    tasks_completed: tasksCompleted,
    tasks_late: tasksLate,
    tasks_rejected: tasksRejected,
    tasks_pending: tasksPending,
    tasks_overdue: tasksOverdue,
    completion_rate: completionRate,
    deadline_miss_rate: deadlineMissRate,
    overdue_rate: overdueRate,
    avg_delay_hours: avgDelayHours,
    assigned_7d: assigned7d,
    completed_7d: completed7d,
    recent_completion_rate: recentCompletionRate,

    // Ratings
    ratings_count: ratingsCount,
    avg_rating: avgRating,
    rating_trend_change: ratingTrendChange,
    rating_variance: ratingVariance,

    // Attendance
    attendance_total_marked: totalMarked,
    attendance_present: presentDays,
    attendance_absent: absentDays,
    attendance_half_days: halfDays,
    attendance_rate: attendanceRate,
    absence_streak: absenceStreak,
    attendance_trend_change: attendanceTrendChange,

    // History
    previous_risk: previousRisk,
    period_days: periodDays,
  };
}

// ---------------------------------------------------------------------------
// Save a new risk score snapshot (atomically mark previous as not-latest)
// ---------------------------------------------------------------------------
async function saveRiskScore(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Mark any existing latest snapshot as historical
    await client.query(
      `UPDATE performance_risk_scores
       SET is_latest = FALSE, updated_at = NOW()
       WHERE intern_id = $1 AND is_latest = TRUE`,
      [data.intern_id]
    );

    // Insert new snapshot
    const res = await client.query(
      `INSERT INTO performance_risk_scores (
         intern_id, risk_score, risk_level, performance_score, performance_level,
         confidence, data_quality, trend_direction, trend_change, previous_risk_score,
         factors, predictions, feature_snapshot,
         signal_count, attendance_days, tasks_assigned, ratings_count,
         is_latest, model_version, period_start, period_end
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11::jsonb,$12::jsonb,$13::jsonb,
         $14,$15,$16,$17,
         TRUE,$18,$19::timestamptz,$20::timestamptz
       ) RETURNING *`,
      [
        data.intern_id,
        data.risk_score,
        data.risk_level,
        data.performance_score,
        data.performance_level,
        data.confidence,
        data.data_quality,
        data.trend_direction,
        data.trend_change || 0,
        data.previous_risk_score || null,
        JSON.stringify(data.factors || []),
        JSON.stringify(data.predictions || []),
        JSON.stringify(data.feature_snapshot || {}),
        data.signal_count || 0,
        data.attendance_days || 0,
        data.tasks_assigned || 0,
        data.ratings_count || 0,
        data.model_version || 'v1.0-deterministic',
        data.period_start || null,
        data.period_end || null,
      ]
    );

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Get current risk score for a single intern
// ---------------------------------------------------------------------------
async function getLatestRiskScore(internId) {
  const res = await pool.query(
    `SELECT prs.*, u.full_name, u.email, u.role, d.name AS department_name
     FROM performance_risk_scores prs
     JOIN users u ON u.id = prs.intern_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE prs.intern_id = $1 AND prs.is_latest = TRUE`,
    [internId]
  );
  return res.rows[0] || null;
}

// ---------------------------------------------------------------------------
// Get risk score history for an intern (most recent first, paginated)
// ---------------------------------------------------------------------------
async function getRiskHistory(internId, limit = 20) {
  const res = await pool.query(
    `SELECT id, intern_id, risk_score, risk_level, performance_score, performance_level,
            confidence, data_quality, trend_direction, trend_change,
            model_version, computed_at, period_start, period_end,
            signal_count, tasks_assigned, ratings_count, attendance_days
     FROM performance_risk_scores
     WHERE intern_id = $1
     ORDER BY computed_at DESC
     LIMIT $2`,
    [internId, limit]
  );
  return res.rows;
}

// ---------------------------------------------------------------------------
// Get dashboard: latest risk scores for all active interns
// (with RBAC: TL/Captain only see their subordinates' data)
// ---------------------------------------------------------------------------
async function getDashboardRiskScores({
  requestingUserId,
  requestingUserRole,
  departmentId,
  riskLevel,
  page = 1,
  limit = 50,
}) {
  const offset = (page - 1) * limit;
  const conditions = ['u.deleted_at IS NULL', "u.role IN ('INTERN','CAPTAIN')"];
  const params = [];

  // RBAC filter: TL & Captain see only their subordinates
  if (requestingUserRole === 'TL' || requestingUserRole === 'CAPTAIN') {
    params.push(requestingUserId);
    conditions.push(`u.id IN (
      WITH RECURSIVE subordinates AS (
        SELECT id FROM users WHERE manager_id = $${params.length} AND deleted_at IS NULL
        UNION ALL
        SELECT usr.id FROM users usr
        JOIN subordinates s ON usr.manager_id = s.id WHERE usr.deleted_at IS NULL
      )
      SELECT id FROM subordinates
    )`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`u.department_id = $${params.length}`);
  }

  if (riskLevel && RISK_LEVELS.includes(riskLevel)) {
    params.push(riskLevel);
    conditions.push(`prs.risk_level = $${params.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Count
  const countRes = await pool.query(
    `SELECT COUNT(*) FROM users u
     LEFT JOIN performance_risk_scores prs ON prs.intern_id = u.id AND prs.is_latest = TRUE
     ${whereClause}`,
    params
  );
  const total = Number(countRes.rows[0].count);

  // Data
  const dataParams = [...params, limit, offset];
  const limitIdx = dataParams.length - 1;
  const offsetIdx = dataParams.length;

  const res = await pool.query(
    `SELECT
       u.id, u.full_name, u.email, u.role,
       d.name AS department_name,
       prs.id AS risk_score_id,
       prs.risk_score,
       prs.risk_level,
       prs.performance_score,
       prs.performance_level,
       prs.confidence,
       prs.data_quality,
       prs.trend_direction,
       prs.trend_change,
       prs.signal_count,
       prs.tasks_assigned,
       prs.attendance_days,
       prs.ratings_count,
       prs.computed_at,
       (SELECT COUNT(*) FROM performance_alerts pa
        WHERE pa.intern_id = u.id AND pa.status = 'ACTIVE') AS active_alert_count
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     LEFT JOIN performance_risk_scores prs ON prs.intern_id = u.id AND prs.is_latest = TRUE
     ${whereClause}
     ORDER BY COALESCE(prs.risk_score, -1) DESC, u.full_name ASC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    dataParams
  );

  return { data: res.rows, total, page, limit };
}

// ---------------------------------------------------------------------------
// Risk distribution summary for dashboard header
// ---------------------------------------------------------------------------
async function getRiskDistribution(requestingUserId, requestingUserRole) {
  let subordinateFilter = '';
  const params = [];

  if (requestingUserRole === 'TL' || requestingUserRole === 'CAPTAIN') {
    params.push(requestingUserId);
    subordinateFilter = `AND u.id IN (
      WITH RECURSIVE subordinates AS (
        SELECT id FROM users WHERE manager_id = $1 AND deleted_at IS NULL
        UNION ALL
        SELECT usr.id FROM users usr
        JOIN subordinates s ON usr.manager_id = s.id WHERE usr.deleted_at IS NULL
      )
      SELECT id FROM subordinates
    )`;
  }

  const res = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE prs.is_latest IS NULL) AS no_prediction,
       COUNT(*) FILTER (WHERE prs.risk_level = 'VERY_LOW') AS very_low,
       COUNT(*) FILTER (WHERE prs.risk_level = 'LOW') AS low,
       COUNT(*) FILTER (WHERE prs.risk_level = 'MODERATE') AS moderate,
       COUNT(*) FILTER (WHERE prs.risk_level = 'HIGH') AS high,
       COUNT(*) FILTER (WHERE prs.risk_level = 'CRITICAL') AS critical,
       COUNT(*) AS total,
       ROUND(AVG(prs.risk_score)::numeric, 1) AS avg_risk_score,
       ROUND(AVG(prs.confidence)::numeric, 2) AS avg_confidence
     FROM users u
     LEFT JOIN performance_risk_scores prs ON prs.intern_id = u.id AND prs.is_latest = TRUE
     WHERE u.deleted_at IS NULL AND u.role IN ('INTERN','CAPTAIN')
     ${subordinateFilter}`,
    params
  );
  return res.rows[0];
}

module.exports = {
  gatherRiskFeatures,
  saveRiskScore,
  getLatestRiskScore,
  getRiskHistory,
  getDashboardRiskScores,
  getRiskDistribution,
  classifyRisk,
  classifyDataQuality,
};
