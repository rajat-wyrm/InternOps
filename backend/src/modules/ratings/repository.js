const pool = require('../../config/db');
const { assertActivityAllowed } = require('../team/lifecycle');
const {
  getFourWeekIndex,
  getFourWeekRatingPeriods,
} = require('./ratingPeriods');

async function addRating(rated, by, score, remarks, periodStart, periodEnd) {
  await assertActivityAllowed(pool, rated, periodEnd);
  const periodKey = `${rated}:${periodStart}:${periodEnd}`;
  try {
    const res = await pool.query(
      `INSERT INTO ratings (rated_user_id,rated_by,score,remarks,rating_period_start,rating_period_end,manual_period_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [rated, by, score, remarks, periodStart, periodEnd, periodKey]
    );
    return res.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      throw Object.assign(
        new Error('A rating already exists for this member and week'),
        { statusCode: 409 }
      );
    }
    throw error;
  }
}
async function getRatings(userId) {
  const res = await pool.query(
    'SELECT * FROM ratings WHERE rated_user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC',
    [userId]
  );
  return res.rows;
}

async function getDepartmentRatingsSheet({
  departmentId,
  requesterId,
  isAdmin,
  requesterRole,
  from,
  to,
}) {
  const departmentWide = isAdmin || requesterRole === 'SENIOR_TL';
  const memberScope = departmentWide
    ? `SELECT id, full_name, email, role, department_id, intern_code,
              internship_status, suspended
       FROM users
       WHERE department_id = $1 AND deleted_at IS NULL`
    : `WITH RECURSIVE visible_users AS (
         SELECT id, full_name, email, role, department_id, manager_id,
                intern_code, internship_status, suspended, 0 AS depth
         FROM users
         WHERE id = $2 AND deleted_at IS NULL
         UNION ALL
         SELECT u.id, u.full_name, u.email, u.role, u.department_id, u.manager_id,
                u.intern_code, u.internship_status, u.suspended,
                visible_users.depth + 1
         FROM users u
         INNER JOIN visible_users ON u.manager_id = visible_users.id
         WHERE u.deleted_at IS NULL AND visible_users.depth < 100
       )
       SELECT id, full_name, email, role, department_id, intern_code,
              internship_status, suspended
       FROM visible_users
       WHERE department_id = $1`;

  const memberParams = departmentWide
    ? [departmentId]
    : [departmentId, requesterId];
  const membersResult = await pool.query(memberScope, memberParams);
  const members = membersResult.rows;
  const memberIds = members.map((member) => member.id);

  if (memberIds.length === 0) {
    return { members: [], available_months: [] };
  }

  const availableMonthsResult = await pool.query(
    `SELECT DISTINCT TO_CHAR(
              DATE_TRUNC(
                'month',
                COALESCE(r.rating_period_end, r.created_at::date)
              ),
              'YYYY-MM'
            ) AS month
     FROM ratings r
     WHERE r.rated_user_id = ANY($1::uuid[])
       AND r.deleted_at IS NULL
     ORDER BY month DESC`,
    [memberIds]
  );

  const ratingsResult = await pool.query(
    `SELECT r.rated_user_id,
            r.score,
            r.remarks,
            r.created_at,
            TO_CHAR(r.rating_period_start, 'YYYY-MM-DD') AS rating_period_start,
            TO_CHAR(r.rating_period_end, 'YYYY-MM-DD') AS rating_period_end,
            ROW_NUMBER() OVER (
              PARTITION BY r.rated_user_id
              ORDER BY COALESCE(r.rating_period_end, r.created_at::date) DESC,
                       r.created_at DESC
            ) AS recency
     FROM ratings r
     WHERE r.rated_user_id = ANY($1::uuid[])
       AND COALESCE(r.rating_period_end, r.created_at::date) >= $2::date
       AND COALESCE(r.rating_period_start, r.created_at::date) <
           ($3::date + interval '1 day')
       AND r.deleted_at IS NULL
     ORDER BY COALESCE(r.rating_period_start, r.created_at::date) ASC,
              r.created_at ASC`,
    [memberIds, from, to]
  );

  const selectedMonth = String(from).slice(0, 7);
  const officialPeriods = getFourWeekRatingPeriods(selectedMonth);
  const grouped = new Map();
  for (const row of ratingsResult.rows) {
    if (!grouped.has(row.rated_user_id)) grouped.set(row.rated_user_id, []);
    grouped.get(row.rated_user_id).push(row);
  }

  return {
    available_months: [
      selectedMonth,
      ...availableMonthsResult.rows
        .map((row) => row.month)
        .filter((month) => month !== selectedMonth),
    ],
    members: members.map((member) => {
      const userRatings = grouped.get(member.id) || [];
      const newestByWeek = new Map();
      for (const rating of [...userRatings].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      )) {
        const startValue =
          rating.rating_period_start || String(rating.created_at).slice(0, 10);
        const weekIndex = getFourWeekIndex(startValue);
        if (weekIndex >= 0 && !newestByWeek.has(weekIndex))
          newestByWeek.set(weekIndex, rating);
      }
      const normalizedRatings = officialPeriods
        .map((period, index) => {
          const rating = newestByWeek.get(index);
          return rating
            ? {
                ...rating,
                rating_period_start: period.start,
                rating_period_end: period.end,
              }
            : null;
        })
        .filter(Boolean);
      const latest = userRatings.find((rating) => Number(rating.recency) === 1);
      const average = userRatings.length
        ? userRatings.reduce((sum, rating) => sum + Number(rating.score), 0) /
          userRatings.length
        : null;

      return {
        ...member,
        average_score: average == null ? null : Number(average.toFixed(1)),
        rating_count: userRatings.length,
        latest_score: latest ? Number(latest.score) : null,
        latest_remarks: latest?.remarks || null,
        latest_created_at: latest?.created_at || null,
        weekly_ratings: normalizedRatings.map((rating) => ({
          score: rating.score == null ? null : Number(rating.score),
          remarks: rating.remarks || null,
          created_at: rating.created_at,
          period_start: rating.rating_period_start || null,
          period_end: rating.rating_period_end || null,
        })),
      };
    }),
  };
}

async function getRatingHistory(userId) {
  const res = await pool.query(
    'SELECT * FROM ratings WHERE rated_user_id=$1 AND deleted_at IS NULL ORDER BY created_at ASC',
    [userId]
  );
  return res.rows;
}

async function getRatingsByDepartment(deptId) {
  const res = await pool.query(
    `SELECT r.*, u.full_name AS rated_user_name, u.email AS rated_user_email,
            rb.full_name AS rated_by_name, rb.email AS rated_by_email
     FROM ratings r
     JOIN users u ON u.id = r.rated_user_id
     LEFT JOIN users rb ON rb.id = r.rated_by
     WHERE u.department_id = $1 AND r.deleted_at IS NULL
     ORDER BY r.created_at DESC`,
    [deptId]
  );
  return res.rows;
}

module.exports = {
  addRating,
  getRatings,
  getDepartmentRatingsSheet,
  getRatingHistory,
  getRatingsByDepartment,
};
