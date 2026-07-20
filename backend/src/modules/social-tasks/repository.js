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

async function assignTask(taskId, userIds, assignedBy) {
  // Return if no users are provided
  if (!userIds || userIds.length === 0) {
    return;
  }

  // Validate UUIDs
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!userIds.every((id) => UUID_RE.test(id))) {
    throw new Error('Invalid userId: all entries must be UUIDs');
  }

  await pool.query(
    `
      INSERT INTO task_assignments (task_id, user_id, assigned_by)
      SELECT
        $1,
        unnest($2::uuid[]),
        $3
      ON CONFLICT (task_id, user_id) DO NOTHING
    `,
    [taskId, userIds, assignedBy]
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
    `SELECT 1 FROM social_tasks st
     WHERE st.id = $1 AND st.deleted_at IS NULL
       AND (
         NOT EXISTS (
           SELECT 1 FROM task_assignments
           WHERE task_id = st.id AND deleted_at IS NULL
         )
         OR EXISTS (
           SELECT 1 FROM task_assignments
           WHERE task_id = st.id
             AND user_id = $2
             AND deleted_at IS NULL
         )
       )`,
    [taskId, userId]
  );

  return res.rowCount > 0;
}

async function getAllInternEmails(limit = 500, offset = 0) {
  const res = await pool.query(
    `SELECT email
     FROM users
     WHERE role IN ('INTERN', 'CAPTAIN')
       AND email IS NOT NULL
     ORDER BY id
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return res.rows.map((row) => row.email);
}

async function getInternEmailCount() {
  const res = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM users
     WHERE role IN ('INTERN', 'CAPTAIN')
       AND email IS NOT NULL`
  );

  return res.rows[0].count;
}

// Shared WHERE-clause builder so getTasks and getTasksCount can never
// drift out of sync with each other (same filters, same params order
// up to the point pagination params are appended).
function buildTaskFilterClause(filters, userId, userRole) {
  const params = [];
  const where = ['st.deleted_at IS NULL'];

  if (!['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'].includes(userRole)) {
    params.push(userId);
    where.push(
      `(
         NOT EXISTS (SELECT 1 FROM task_assignments WHERE task_id = st.id AND deleted_at IS NULL)
         OR st.id IN (SELECT task_id FROM task_assignments WHERE user_id = $${params.length} AND deleted_at IS NULL)
         OR st.created_by = $${params.length}
       )`
    );
  }

  if (filters.deadlineBefore) {
    params.push(filters.deadlineBefore);
    where.push(`st.deadline <= $${params.length}`);
  }

  return { whereSql: `WHERE ${where.join(' AND ')}`, params };
}

async function getTasks(filters, userId, userRole, page = 1, limit = 50) {
  const safeLimit = Math.min(Number(limit) || 50, 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const { whereSql, params } = buildTaskFilterClause(filters, userId, userRole);

  params.push(safeLimit);
  params.push(offset);

  const q = `
    SELECT st.*
    FROM social_tasks st
    ${whereSql}
    ORDER BY st.created_at DESC
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
  `;

  return (await pool.query(q, params)).rows;
}

async function getTasksCount(filters, userId, userRole) {
  const { whereSql, params } = buildTaskFilterClause(filters, userId, userRole);

  const q = `
    SELECT COUNT(*)::int AS count
    FROM social_tasks st
    ${whereSql}
  `;

  const res = await pool.query(q, params);
  return res.rows[0].count;
}

async function submitProof(
  taskId,
  internId,
  imagePath,
  { didComment = false, didRepost = false, didShare = false } = {}
) {
  const res = await pool.query(
    `INSERT INTO proof_submissions
      (
        task_id,
        intern_id,
        image_path,
        did_comment,
        did_repost,
        did_share
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
    [taskId, internId, imagePath, didComment, didRepost, didShare]
  );

  return res.rows[0];
}

async function submitProofWithImages(
  taskId,
  internId,
  imagePaths,
  { didComment = false, didRepost = false, didShare = false } = {}
) {
  // Create proof record with engagement actions
  const proof = await submitProof(taskId, internId, null, {
    didComment,
    didRepost,
    didShare,
  });

  if (imagePaths && imagePaths.length > 0) {
    const values = imagePaths.map((_, i) => `($1, $${i + 2})`).join(',');

    await pool.query(
      `INSERT INTO proof_images (proof_id, image_path)
       VALUES ${values}`,
      [proof.id, ...imagePaths]
    );
  }

  return proof;
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
      `SELECT ps.*, u.full_name AS intern_name, u.email AS intern_email,
        COALESCE(
          (SELECT json_agg(json_build_object('id', pi.id, 'image_path', pi.image_path)) FROM proof_images pi WHERE pi.proof_id = ps.id),
          '[]'::json
        ) AS images
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
      `SELECT ps.*,
        COALESCE(
          (SELECT json_agg(json_build_object('id', pi.id, 'image_path', pi.image_path)) FROM proof_images pi WHERE pi.proof_id = ps.id),
          '[]'::json
        ) AS images
       FROM proof_submissions ps 
       WHERE ps.intern_id=$1 AND ps.deleted_at IS NULL`,
      [internId]
    )
  ).rows;
}

async function getProof(proofId) {
  const res = await pool.query(
    `SELECT ps.*,
      COALESCE(
        (SELECT json_agg(json_build_object('id', pi.id, 'image_path', pi.image_path)) FROM proof_images pi WHERE pi.proof_id = ps.id),
        '[]'::json
      ) AS images
     FROM proof_submissions ps WHERE ps.id = $1`,
    [proofId]
  );
  return res.rows[0] || null;
}

async function updateTask(
  taskId,
  { title, description, targetPlatform, taskLink, deadline }
) {
  const res = await pool.query(
    `UPDATE social_tasks
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         target_platform = COALESCE($3, target_platform),
         task_link = COALESCE($4, task_link),
         deadline = COALESCE($5, deadline)
     WHERE id = $6 AND deleted_at IS NULL
     RETURNING *`,
    [title, description, targetPlatform, taskLink, deadline, taskId]
  );
  return res.rows[0] || null;
}

async function deleteTask(taskId) {
  await pool.query('UPDATE social_tasks SET deleted_at = NOW() WHERE id = $1', [
    taskId,
  ]);
}

async function deleteProof(proofId) {
  await pool.query(
    'UPDATE proof_submissions SET deleted_at = NOW() WHERE id = $1',
    [proofId]
  );
}

async function getProofImage(imageId) {
  const res = await pool.query('SELECT * FROM proof_images WHERE id = $1', [
    imageId,
  ]);
  return res.rows[0] || null;
}

async function deleteProofImage(imageId) {
  await pool.query('UPDATE proof_images SET deleted_at = NOW() WHERE id = $1', [
    imageId,
  ]);
}

module.exports = {
  createTask,
  updateTask,
  deleteTask,
  assignTask,
  getUserEmail,
  isTaskAssignedToUser,
  getTasks,
  getTasksCount,
  submitProof,
  submitProofWithImages,
  verifyProof,
  getProofsByTask,
  getProofsByIntern,

  getProof,
  deleteProof,
  getProofImage,
  deleteProofImage,
  getAllInternEmails,
  getInternEmailCount,
};
