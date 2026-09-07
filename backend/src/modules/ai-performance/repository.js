const pool = require('../../config/db');

async function gatherInternPerformanceData(internId, periodStart, periodEnd) {
  const startIso =
    periodStart || new Date(Date.now() - 30 * 86400000).toISOString();
  const endIso = periodEnd || new Date().toISOString();

  // 1. Fetch Intern details & User info
  const userRes = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.role, u.department_id, d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [internId]
  );

  if (userRes.rows.length === 0) {
    throw Object.assign(new Error('Intern not found'), { statusCode: 404 });
  }
  const intern = userRes.rows[0];

  // 2. Fetch Tasks & Task Assignments & Proof Submissions
  const taskRes = await pool.query(
    `SELECT t.id, t.title, t.deadline, t.created_at,
            p.id AS proof_id, p.status AS proof_status, p.verified_at, p.created_at AS submitted_at
     FROM task_assignments ta
     JOIN social_tasks t ON t.id = ta.task_id
     LEFT JOIN proof_submissions p ON p.task_id = t.id AND p.intern_id = ta.user_id AND p.deleted_at IS NULL
     WHERE ta.user_id = $1 AND ta.deleted_at IS NULL
       AND t.deleted_at IS NULL
       AND t.created_at >= $2::timestamptz AND t.created_at <= $3::timestamptz`,
    [internId, startIso, endIso]
  );

  let tasksAssigned = taskRes.rows.length;
  let tasksCompleted = 0;
  let tasksLate = 0;
  let tasksRejected = 0;
  let revisionsCount = 0;

  for (const row of taskRes.rows) {
    if (row.proof_status === 'APPROVED' || row.proof_status === 'VERIFIED') {
      tasksCompleted++;
      if (
        row.deadline &&
        row.submitted_at &&
        new Date(row.submitted_at) > new Date(row.deadline)
      ) {
        tasksLate++;
      }
    } else if (row.proof_status === 'REJECTED') {
      tasksRejected++;
      revisionsCount++;
    }
  }

  // 3. Fetch Ratings
  const ratingRes = await pool.query(
    `SELECT score, remarks, created_at
     FROM ratings
     WHERE rated_user_id = $1 AND deleted_at IS NULL
       AND created_at >= $2::timestamptz AND created_at <= $3::timestamptz
     ORDER BY created_at ASC`,
    [internId, startIso, endIso]
  );

  const ratings = ratingRes.rows;
  const ratingsCount = ratings.length;
  const ratingScores = ratings.map((r) => Number(r.score));
  const avgRatingScore =
    ratingsCount > 0
      ? ratingScores.reduce((a, b) => a + b, 0) / ratingsCount
      : null;
  const ratingComments = ratings.map((r) => r.remarks).filter(Boolean);

  // 4. Fetch Attendance
  const attendanceRes = await pool.query(
    `SELECT status FROM attendance
     WHERE user_id = $1 AND deleted_at IS NULL
       AND date >= $2::date AND date <= $3::date`,
    [internId, startIso.slice(0, 10), endIso.slice(0, 10)]
  );

  let attendanceDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  for (const row of attendanceRes.rows) {
    if (row.status === 'PRESENT') attendanceDays++;
    else if (row.status === 'ABSENT') absentDays++;
    else if (row.status === 'HALF_DAY') lateDays++;
  }

  // 5. Fetch GitHub PR Sync Activity if available
  const githubRes = await pool
    .query(
      `SELECT COUNT(*) AS total_events,
            COUNT(*) FILTER (WHERE action = 'opened' OR action = 'submitted') AS pr_count,
            COUNT(*) FILTER (WHERE action = 'closed' OR action = 'merged') AS merged_prs
     FROM github_sync_log
     WHERE triggered_by = $1 OR details->>'user_id' = $1`,
      [internId]
    )
    .catch(() => ({ rows: [{ pr_count: 0, merged_prs: 0 }] }));

  const prCount = Number(githubRes.rows[0]?.pr_count || 0);
  const mergedPrs = Number(githubRes.rows[0]?.merged_prs || 0);

  // 6. Fetch previous review for longitudinal trend calculation
  const prevReviewRes = await pool.query(
    `SELECT id, overall_score, performance_level, score_breakdown, created_at
     FROM ai_performance_reviews
     WHERE intern_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [internId]
  );
  const previousReview = prevReviewRes.rows[0] || null;

  return {
    intern_id: intern.id,
    intern_name: intern.full_name || intern.email,
    department: intern.department_name || 'General',
    review_period_start: startIso,
    review_period_end: endIso,

    tasks_assigned: tasksAssigned,
    tasks_completed: tasksCompleted,
    tasks_late: tasksLate,
    tasks_rejected: tasksRejected,
    tasks_reopened: 0,
    revisions_count: revisionsCount,
    avg_evaluation_score: avgRatingScore,

    ratings_count: ratingsCount,
    avg_rating_score: avgRatingScore,
    historical_ratings: ratingScores,
    rating_comments: ratingComments,

    issue_count: tasksRejected,
    recurring_issue_types:
      tasksRejected > 0 ? ['Task proof verification failure'] : [],
    rejection_reasons: [],

    pr_count: prCount,
    merged_prs: mergedPrs,
    review_iterations: prCount > 0 ? 1.5 : 0,
    review_comments: [],
    ci_failures: 0,

    attendance_days: attendanceDays,
    absent_days: absentDays,
    late_days: lateDays,

    previous_review: previousReview,
  };
}

async function savePerformanceReview(reviewData) {
  const query = `
    INSERT INTO ai_performance_reviews (
      intern_id, created_by, review_period_start, review_period_end,
      overall_score, performance_level, confidence, status, summary,
      score_breakdown, deterministic_metrics, strengths, development_areas,
      recurring_issues, recommendations, learning_plan, early_warning,
      performance_trend, manager_summary, intern_feedback, evidence,
      model_provider, model_name, created_at, updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16, $17,
      $18, $19, $20, $21, $22, $23, NOW(), NOW()
    )
    RETURNING *
  `;

  const values = [
    reviewData.intern_id,
    reviewData.created_by || null,
    reviewData.review_period_start,
    reviewData.review_period_end,
    reviewData.overall_score,
    reviewData.performance_level,
    reviewData.confidence || 0.85,
    reviewData.status || 'completed',
    reviewData.summary || '',
    JSON.stringify(reviewData.score_breakdown || {}),
    JSON.stringify(reviewData.deterministic_metrics || {}),
    JSON.stringify(reviewData.strengths || []),
    JSON.stringify(reviewData.development_areas || []),
    JSON.stringify(reviewData.recurring_issues || []),
    JSON.stringify(reviewData.recommendations || []),
    JSON.stringify(reviewData.learning_plan || []),
    JSON.stringify(reviewData.early_warning || {}),
    JSON.stringify(reviewData.performance_trend || {}),
    reviewData.manager_summary || '',
    reviewData.intern_feedback || '',
    JSON.stringify(reviewData.evidence || []),
    reviewData.model_provider || 'gemini',
    reviewData.model_name || 'gemini-2.5-flash',
  ];

  const res = await pool.query(query, values);
  return res.rows[0];
}

async function getLatestReview(internId) {
  const res = await pool.query(
    `SELECT * FROM ai_performance_reviews
     WHERE intern_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [internId]
  );
  return res.rows[0] || null;
}

async function getReviewHistory(internId) {
  const res = await pool.query(
    `SELECT id, intern_id, review_period_start, review_period_end,
            overall_score, performance_level, confidence, status, summary,
            early_warning, performance_trend, created_at
     FROM ai_performance_reviews
     WHERE intern_id = $1
     ORDER BY created_at DESC`,
    [internId]
  );
  return res.rows;
}

async function getReviewById(reviewId) {
  const res = await pool.query(
    `SELECT * FROM ai_performance_reviews WHERE id = $1`,
    [reviewId]
  );
  return res.rows[0] || null;
}

module.exports = {
  gatherInternPerformanceData,
  savePerformanceReview,
  getLatestReview,
  getReviewHistory,
  getReviewById,
};
