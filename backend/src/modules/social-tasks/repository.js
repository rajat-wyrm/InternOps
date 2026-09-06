const pool = require('../../config/db');
const { assertActivityAllowed } = require('../team/lifecycle');
async function createTask({
  title,
  description,
  targetPlatform,
  taskLink,
  deadline,
  createdBy,
  githubIssueId,
  githubIssueNumber,
  githubRepo,
  githubIssueUrl,
  source,
  imagePath,
}) {
  const hasGithubFields =
    githubIssueId || githubIssueNumber || githubRepo || githubIssueUrl;
  if (hasGithubFields) {
    const res = await pool.query(
      `INSERT INTO social_tasks
        (title, description, target_platform, task_link, deadline, created_by,
         github_issue_id, github_issue_number, github_repo, github_issue_url, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        title,
        description,
        targetPlatform,
        taskLink,
        deadline,
        createdBy,
        githubIssueId || null,
        githubIssueNumber || null,
        githubRepo || null,
        githubIssueUrl || null,
        source || 'manual',
      ]
    );
    return res.rows[0];
  }
  const res = await pool.query(
    'INSERT INTO social_tasks (title, description, target_platform, task_link, deadline, created_by, image_path) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [
      title,
      description,
      targetPlatform,
      taskLink,
      deadline,
      createdBy,
      imagePath || null,
    ]
  );
  return res.rows[0];
}

async function assignTask(taskId, userIds, assignedBy) {
  if (!userIds || userIds.length === 0) return;
  for (const userId of userIds)
    await assertActivityAllowed(
      pool,
      userId,
      new Date().toISOString().slice(0, 10)
    );
  const values = userIds
    .map((_, i) => `($1, $${i + 2}, $${userIds.length + 2})`)
    .join(',');
  await pool.query(
    `INSERT INTO task_assignments (task_id, user_id, assigned_by) VALUES ${values}`,
    [taskId, ...userIds, assignedBy]
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
         NOT EXISTS (SELECT 1 FROM task_assignments WHERE task_id = st.id AND deleted_at IS NULL)
         OR EXISTS (SELECT 1 FROM task_assignments WHERE task_id = st.id AND user_id = $2 AND deleted_at IS NULL)
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
       AND COALESCE(internship_status,'ACTIVE') = 'ACTIVE'
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
       AND COALESCE(internship_status,'ACTIVE') = 'ACTIVE'
       AND email IS NOT NULL`
  );
  return res.rows[0].count;
}
async function getTasks(filters, userId, userRole, page = 1, limit = 50) {
  const params = [];

  const safeLimit = Math.min(Number(limit) || 50, 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

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

  if (
    filters.department_id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      filters.department_id
    )
  ) {
    params.push(filters.department_id);
    const pIdx = params.length;
    where.push(
      `(
         st.created_by IN (SELECT id FROM users WHERE department_id = $${pIdx}::uuid AND deleted_at IS NULL)
         OR st.id IN (
           SELECT ta.task_id FROM task_assignments ta 
           JOIN users u ON u.id = ta.user_id 
           WHERE u.department_id = $${pIdx}::uuid AND ta.deleted_at IS NULL
         )
      )`
    );
  }

  if (filters.source) {
    params.push(filters.source);
    where.push(`st.source = $${params.length}`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
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

async function getTaskById(taskId) {
  const res = await pool.query(
    `SELECT * FROM social_tasks WHERE id = $1 AND deleted_at IS NULL`,
    [taskId]
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
         deadline = COALESCE($5, deadline),
         last_synced_at = NOW()
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

async function getTaskAnalytics(taskId) {
  const task = await getTaskById(taskId);
  if (!task) return null;

  const deptsRes = await pool.query(
    'SELECT id, name FROM departments WHERE deleted_at IS NULL ORDER BY name ASC'
  );
  const departments = deptsRes.rows;

  const query = `
    WITH target_users AS (
      SELECT 
        u.id, 
        u.full_name, 
        u.email, 
        u.department_id, 
        u.position,
        COALESCE(d.name, 'Unassigned') AS department_name
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id AND d.deleted_at IS NULL
      WHERE u.deleted_at IS NULL AND u.suspended = FALSE
        AND (
          (EXISTS (SELECT 1 FROM task_assignments WHERE task_id = $1 AND deleted_at IS NULL)
           AND u.id IN (SELECT user_id FROM task_assignments WHERE task_id = $1 AND deleted_at IS NULL))
          OR
          (NOT EXISTS (SELECT 1 FROM task_assignments WHERE task_id = $1 AND deleted_at IS NULL)
           AND u.role = 'INTERN')
        )
    )
    SELECT 
      tu.*,
      ps.id AS proof_id,
      ps.status AS proof_status,
      ps.created_at AS submitted_at,
      ps.verified_at,
      ps.did_comment,
      ps.did_repost,
      ps.did_share,
      COALESCE(
        (SELECT json_agg(json_build_object('id', pi.id, 'image_path', pi.image_path)) 
         FROM proof_images pi WHERE pi.proof_id = ps.id),
        '[]'::json
      ) AS images
    FROM target_users tu
    LEFT JOIN proof_submissions ps ON ps.task_id = $1 AND ps.intern_id = tu.id AND ps.deleted_at IS NULL
    ORDER BY tu.department_name ASC, tu.full_name ASC
  `;

  const { rows: interns } = await pool.query(query, [taskId]);

  const totalInterns = interns.length;
  const verifiedCount = interns.filter(
    (i) => i.proof_status === 'VERIFIED'
  ).length;
  const pendingCount = interns.filter(
    (i) => i.proof_status === 'PENDING'
  ).length;
  const rejectedCount = interns.filter(
    (i) => i.proof_status === 'REJECTED'
  ).length;
  const notSubmittedCount = interns.filter((i) => !i.proof_status).length;
  const completionRate =
    totalInterns > 0 ? Math.round((verifiedCount / totalInterns) * 100) : 0;

  const deptMap = new Map();
  departments.forEach((d) => {
    deptMap.set(d.id, {
      department_id: d.id,
      department_name: d.name,
      total_interns: 0,
      verified_count: 0,
      pending_count: 0,
      rejected_count: 0,
      not_submitted_count: 0,
      completion_rate: 0,
    });
  });

  const unassignedKey = 'unassigned';

  interns.forEach((intern) => {
    const dId = intern.department_id || unassignedKey;
    if (!deptMap.has(dId)) {
      deptMap.set(dId, {
        department_id: intern.department_id || null,
        department_name: intern.department_name || 'Unassigned',
        total_interns: 0,
        verified_count: 0,
        pending_count: 0,
        rejected_count: 0,
        not_submitted_count: 0,
        completion_rate: 0,
      });
    }

    const deptStat = deptMap.get(dId);
    deptStat.total_interns += 1;
    if (intern.proof_status === 'VERIFIED') deptStat.verified_count += 1;
    else if (intern.proof_status === 'PENDING') deptStat.pending_count += 1;
    else if (intern.proof_status === 'REJECTED') deptStat.rejected_count += 1;
    else deptStat.not_submitted_count += 1;
  });

  deptMap.forEach((stat) => {
    stat.completion_rate =
      stat.total_interns > 0
        ? Math.round((stat.verified_count / stat.total_interns) * 100)
        : 0;
  });

  const departmentStats = Array.from(deptMap.values()).filter(
    (d) =>
      d.total_interns > 0 ||
      departments.some((dept) => dept.id === d.department_id)
  );

  return {
    task,
    summary: {
      total_interns: totalInterns,
      verified_count: verifiedCount,
      pending_count: pendingCount,
      rejected_count: rejectedCount,
      not_submitted_count: notSubmittedCount,
      completion_rate: completionRate,
    },
    departmentStats,
    interns,
  };
}

module.exports = {
  createTask,
  getTaskById,
  getTaskAnalytics,
  updateTask,
  deleteTask,
  assignTask,
  getUserEmail,
  isTaskAssignedToUser,
  getTasks,
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
