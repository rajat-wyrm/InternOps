const pool = require('../../config/db');
async function createTask({
  title,
  description,
  targetPlatform,
  taskLink,
  deadline,
  createdBy,
}) {
  const res = await pool.query(
    'INSERT INTO social_tasks (title, description, target_platform, task_link, deadline, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [title, description, targetPlatform, taskLink, deadline, createdBy]
  );
  return res.rows[0];
}
async function getTasks(filters, userId, userRole) {
  let q = `
    SELECT st.* FROM social_tasks st
    WHERE st.deleted_at IS NULL
  `;
  const params = [];
  if (!['ADMIN', 'SENIOR_TL'].includes(userRole)) {
    params.push(userId);
    q += ` AND st.id IN (
      SELECT task_id FROM task_assignments WHERE user_id = $${params.length}
    )`;
  }
  if (filters.deadlineBefore) {
    params.push(filters.deadlineBefore);
    q += ` AND st.deadline <= $${params.length}`;
  }
  q += ' ORDER BY st.created_at DESC';
  return (await pool.query(q, params)).rows;
}
async function submitProof(taskId, internId, imagePath) {
  const res = await pool.query(
    'INSERT INTO proof_submissions (task_id, intern_id, image_path) VALUES ($1,$2,$3) RETURNING *',
    [taskId, internId, imagePath]
  );
  return res.rows[0];
}
async function verifyProof(proofId, verifierId) {
  const res = await pool.query(
    "UPDATE proof_submissions SET verified_by=$1, verified_at=NOW(), status='VERIFIED' WHERE id=$2 RETURNING *",
    [verifierId, proofId]
  );
  return res.rows[0];
}
async function getProofsByTask(taskId) {
  return (
    await pool.query(
      `SELECT ps.*, u.full_name AS intern_name, u.email AS intern_email
       FROM proof_submissions ps
       LEFT JOIN users u ON u.id = ps.intern_id
       WHERE ps.task_id = $1 AND ps.deleted_at IS NULL`,
      [taskId]
    )
  ).rows;
}
async function getProofsByIntern(internId) {
  return (
    await pool.query(
      'SELECT * FROM proof_submissions WHERE intern_id=$1 AND deleted_at IS NULL',
      [internId]
    )
  ).rows;
}
module.exports = {
  createTask,
  getTasks,
  submitProof,
  verifyProof,
  getProofsByTask,
  getProofsByIntern,
};
