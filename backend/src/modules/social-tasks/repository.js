const pool = require('../../config/db'); // or whatever your database pool import path is at the top

// ... Keep your other top functions here (getUserEmail, isTaskAssignedToUser, getTasks, etc.)

async function verifyProof(proofId, verifierId, verifierRole) {
  const res = await pool.query(
    "UPDATE proof_submissions SET verified_by=$1, verified_at=NOW(), status='VERIFIED' WHERE id=$2 RETURNING *",
    [verifierId, proofId]
  );
  return res.rows[0];
}
async function getAllInternEmails() {
  const res = await pool.query(
    `SELECT email
     FROM users
     WHERE role IN ('INTERN', 'CAPTAIN')
       AND email IS NOT NULL`
  );

  return res.rows.map((row) => row.email);
}
async function getTasks(filters, userId, userRole) {
  const params = [];
  const where = ['st.deleted_at IS NULL'];

  if (!['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'].includes(userRole)) {
    params.push(userId);
    where.push(
      `(st.id IN (SELECT task_id FROM task_assignments WHERE user_id = $${params.length} AND deleted_at IS NULL) OR st.created_by = $${params.length})`
    );
  }

async function updateTask(id, data) {
  const res = await pool.query(
    `UPDATE social_tasks
        SET title = $1,
            description = $2,
            target_platform = $3,
            task_link = $4,
            deadline = $5,
            updated_at = NOW()
        WHERE id = $6
        RETURNING *`,
    [
      data.title,
      data.description,
      data.targetPlatform || data.target_platform,
      data.taskLink || data.task_link,
      data.deadline,
      id,
    ]
  );
  return res.rows[0];
}

async function deleteTask(id) {
  const res = await pool.query(
    `UPDATE social_tasks
        SET deleted_at = NOW()
        WHERE id = $1
        RETURNING *`,
    [id]
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

async function getProof(proofId) {
  const res = await pool.query(
    'SELECT * FROM proof_submissions WHERE id = $1',
    [proofId]
  );
  return res.rows[0] || null;
}

async function deleteProof(proofId) {
  await pool.query(
    'UPDATE proof_submissions SET deleted_at = NOW() WHERE id = $1',
    [proofId]
  );
}

module.exports = {
  getUserEmail,
  isTaskAssignedToUser,
  getTasks,
  updateTask,
  deleteTask,
  submitProof,
  verifyProof,
  getProofsByTask,
  getProofsByIntern,
  getProof,
  deleteProof,
  getAllInternEmails,
};
