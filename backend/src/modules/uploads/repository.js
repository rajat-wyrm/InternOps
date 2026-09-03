const pool = require('../../config/db');
const fs = require('fs');
const path = require('path');
const config = require('../../config');

async function updateAvatarUrl(userId, avatarUrl) {
  await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [
    avatarUrl,
    userId,
  ]);
}
async function getAvatarUrl(userId) {
  const { rows } = await pool.query(
    'SELECT avatar_url FROM users WHERE id = $1',
    [userId]
  );

  return rows[0]?.avatar_url || null;
}

async function createImage(data) {
  const res = await pool.query(
    `INSERT INTO image_library (
      user_id,
      file_path,
      file_name,
      mime_type,
      file_size
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [data.userId, data.filePath, data.fileName, data.mimeType, data.fileSize]
  );

  return res.rows[0];
}

async function getImagesByUserId(userId) {
  const res = await pool.query(
    `SELECT *
     FROM image_library
     WHERE user_id = $1
       AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [userId]
  );

  return res.rows;
}

async function getImageById(id, userId) {
  const res = await pool.query(
    `SELECT *
     FROM image_library
     WHERE id = $1
       AND user_id = $2
       AND deleted_at IS NULL`,
    [id, userId]
  );

  return res.rows[0] || null;
}

async function softDeleteImage(id, userId) {
  const res = await pool.query(
    `UPDATE image_library
     SET deleted_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND user_id = $2
       AND deleted_at IS NULL
     RETURNING *`,
    [id, userId]
  );

  return res.rows[0] || null;
}

async function deleteFile(dbSavedPath) {
  const projectRoot = path.resolve(__dirname, '..', '..', '..');

  const uploadsRoot = path.resolve(projectRoot, config.uploadDir);
  const normalizedPath = dbSavedPath.replace(/^[/\\]+/, '');
  const absolutePath = path.resolve(projectRoot, normalizedPath);

  const relative = path.relative(uploadsRoot, absolutePath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Directory traversal attempt detected');
  }

  try {
    await fs.promises.unlink(absolutePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;

    console.warn(
      `[deleteFile] File not found, skipping unlink: ${absolutePath}`
    );
  }
}

module.exports = {
  getAvatarUrl,
  updateAvatarUrl,
  createImage,
  getImagesByUserId,
  getImageById,
  softDeleteImage,
  deleteFile,
};
