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

async function assignTask(taskId, userIds) {
  if (!userIds || userIds.length === 0) return;
  const values = userIds.map((_, i) => `($1, $${i + 2})`).join(',');
  await pool.query(
    `INSERT INTO task_assignments (task_id, user_id) VALUES ${values}`,
    [taskId, ...userIds]
  );
}
async function getUserEmail(userId) {
  const res = await pool.query('SELECT email FROM users WHERE id = $1', [
    userId,
  ]);
  return res.rows[0]?.email || null;
}
async function isTaskAssignedToUser(taskId, userId) {
  const res = await pool.query(
    `SELECT 1 FROM task_assignments
     WHERE task_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [taskId, userId]
  );
  return res.rowCount > 0;
}
async function getTasks(filters, userId, userRole) {
  const params = [];
  const where = ['st.deleted_at IS NULL'];

  if (!['ADMIN', 'SENIOR_TL'].includes(userRole)) {
    params.push(userId);
    where.push(
      `(st.id IN (SELECT task_id FROM task_assignments WHERE user_id = $${params.length} AND deleted_at IS NULL) OR st.created_by = $${params.length})`
    );
  }

  if (filters.deadlineBefore) {
    params.push(filters.deadlineBefore);
    where.push(`st.deadline <= $${params.length}`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const q = `
    SELECT st.* FROM social_tasks st
    ${whereSql}
    ORDER BY st.created_at DESC
  `;
  return (await pool.query(q, params)).rows;
}
async function submitProof(taskId, internId, imagePath) {
  const res = await pool.query(
    'INSERT INTO proof_submissions (task_id, intern_id, image_path) VALUES ($1,$2,$3) RETURNING *',
    [taskId, internId, imagePath]
  );
  return res.rows[0];
}
async function verifyProof(proofId, verifierId, verifierRole) {
  const proofRes = await pool.query(
    'SELECT intern_id FROM proof_submissions WHERE id = $1',
    [proofId]
  );

  if (proofRes.rowCount === 0) {
    throw new Error('Proof not found');
  }

  if (verifierId === proofRes.rows[0].intern_id) {
    throw new Error('Forbidden: you cannot verify your own proof submission');
  }

  // Admin can verify anyone; everyone else must be in the intern's hierarchy
  if (verifierRole !== 'ADMIN') {
    const { checkHierarchyAccess } = require('../../utils/hierarchy');
    const allowed = await checkHierarchyAccess(
      verifierId,
      proofRes.rows[0].intern_id
    );
    if (!allowed) {
      throw new Error('Forbidden: not in intern hierarchy');
    }
  }

  const res = await pool.query(
    `UPDATE proof_submissions
     SET verified_by = $1,
         verified_at = NOW(),
         status = 'VERIFIED'
     WHERE id = $2
     RETURNING *`,
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
  assignTask,
  getUserEmail,
  isTaskAssignedToUser,
  getTasks,
  submitProof,
  verifyProof,
  getProofsByTask,
  getProofsByIntern,
};
