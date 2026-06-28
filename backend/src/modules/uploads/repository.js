const pool = require('../../config/db');

async function updateAvatarUrl(userId, avatarUrl) {
  await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [
    avatarUrl,
    userId,
  ]);
}

module.exports = {
  updateAvatarUrl,
};
