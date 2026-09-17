const pool = require('../../config/db');

async function getLatestAssessment(userId) {
  const res = await pool.query(
    'SELECT * FROM assessments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  return res.rows[0];
}

async function createAssessment({
  userId,
  score,
  category,
  status = 'COMPLETED',
  questionsCount = 0,
  keyStrengths = [],
  improvementAreas = [],
  nextActions = [],
  feedback = '',
}) {
  const res = await pool.query(
    `INSERT INTO assessments (
      user_id,
      score,
      category,
      status,
      questions_count,
      key_strengths,
      improvement_areas,
      next_actions,
      feedback
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      userId,
      score,
      category,
      status,
      questionsCount,
      keyStrengths,
      improvementAreas,
      nextActions,
      feedback,
    ]
  );
  return res.rows[0];
}

module.exports = {
  getLatestAssessment,
  createAssessment,
};
