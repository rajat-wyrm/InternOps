const pool = require('../../config/db');
const fs = require('fs'); // ADD THIS
const path = require('path'); // ADD THIS
const config = require('../../config');
async function updateAvatarUrl(userId, avatarUrl) {
  await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [
    avatarUrl,
    userId,
  ]);
}

async function deleteFile(dbSavedPath) {
  const absolutePath = path.resolve(__dirname, '..', '..', '..', dbSavedPath);

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
  updateAvatarUrl,
  deleteFile,
};
