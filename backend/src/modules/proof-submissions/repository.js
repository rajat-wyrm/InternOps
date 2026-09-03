const pool = require('../../config/db');
const { assertActivityAllowed } = require('../team/lifecycle');

/**
 * Insert a single proof submission row.
 */
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

/**
 * Insert a proof with multiple image attachments.
 */
async function submitProofWithImages(
  taskId,
  internId,
  imagePaths,
  { didComment = false, didRepost = false, didShare = false } = {}
) {
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

/**
 * Verify a proof submission.  Enforces hierarchy check for non-admins
 * and prevents self-verification.
 */
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

/**
 * Check whether a task is assigned to the given user (or unassigned).
 */
async function isTaskAssignedToUser(taskId, userId) {
  await assertActivityAllowed(
    pool,
    userId,
    new Date().toISOString().slice(0, 10)
  );
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

/**
 * Fetch all proofs for a specific task.
 */
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

/**
 * Fetch all proofs submitted by a specific intern.
 */
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

/**
 * Fetch a single proof by ID.
 */
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

/**
 * Save the AI verification result for a proof submission.
 */
async function saveVerificationResult(proofId, verificationResult) {
  const res = await pool.query(
    `UPDATE proof_submissions
     SET verification_result = $1
     WHERE id = $2
     RETURNING *`,
    [verificationResult, proofId]
  );

  if (res.rowCount === 0) {
    throw new Error('Proof not found');
  }

  return res.rows[0];
}

/**
 * Soft-delete a proof submission.
 */
async function deleteProof(proofId) {
  await pool.query(
    'UPDATE proof_submissions SET deleted_at = NOW() WHERE id = $1',
    [proofId]
  );
}

/**
 * Fetch a single proof image by ID.
 */
async function getProofImage(imageId) {
  const res = await pool.query('SELECT * FROM proof_images WHERE id = $1', [
    imageId,
  ]);
  return res.rows[0] || null;
}

/**
 * Soft-delete a single proof image.
 */
async function deleteProofImage(imageId) {
  await pool.query('UPDATE proof_images SET deleted_at = NOW() WHERE id = $1', [
    imageId,
  ]);
}

module.exports = {
  submitProof,
  submitProofWithImages,
  verifyProof,
  isTaskAssignedToUser,
  getProofsByTask,
  getProofsByIntern,
  getProof,
  saveVerificationResult,
  deleteProof,
  getProofImage,
  deleteProofImage,
};
