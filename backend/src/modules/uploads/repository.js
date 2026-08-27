const pool = require('../../config/db');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
async function addUserImage({
  userId,
  storagePath,
  imageUrl,
  originalFilename,
  mimeType,
  fileSize,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const previous = await client.query(
      `SELECT storage_path FROM user_images
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );
    const result = await client.query(
      `INSERT INTO user_images
        (user_id, storage_path, image_url, original_filename, mime_type, file_size)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, image_url`,
      [
        userId,
        storagePath,
        imageUrl,
        originalFilename || null,
        mimeType,
        fileSize,
      ]
    );
    await client.query(
      'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2',
      [imageUrl, userId]
    );
    await client.query(
      `UPDATE user_images SET deleted_at = NOW()
       WHERE user_id = $1 AND deleted_at IS NULL AND storage_path <> $2`,
      [userId, storagePath]
    );
    await client.query('COMMIT');
    return {
      ...result.rows[0],
      previousStoragePath: previous.rows[0]?.storage_path,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteFile(dbSavedPath) {
  const projectRoot = path.resolve(__dirname, '..', '..', '..');

  const uploadsRoot = path.resolve(projectRoot, config.uploadDir);
  const absolutePath = path.resolve(projectRoot, dbSavedPath);

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
  addUserImage,
  deleteFile,
};
