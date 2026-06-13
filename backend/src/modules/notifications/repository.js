const pool = require('../../config/db');

async function send(userId, message) {
  await pool.query(
    'INSERT INTO notifications (user_id, message) VALUES ($1,$2)',
    [userId, message]
  );
}

async function get(userId, { page = 1, limit = 20 } = {}) {
  const safeLim = Math.min(limit, 100);
  const offset = (page - 1) * safeLim;
  const res = await pool.query(
    `SELECT * FROM notifications
     WHERE user_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, safeLim, offset]
  );
  const countRes = await pool.query(
    'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  return {
    data: res.rows,
    total: parseInt(countRes.rows[0].count, 10),
    page,
    limit,
  };
}

async function markRead(notificationId, userId) {
  const res = await pool.query(
    'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
    [notificationId, userId]
  );
  if (res.rowCount === 0) {
    throw new Error('Notification not found or does not belong to this user');
  }
}

async function markAllRead(userId) {
  await pool.query(
    'UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE AND deleted_at IS NULL',
    [userId]
  );
}

async function deleteNotification(notificationId, userId) {
  await pool.query(
    'UPDATE notifications SET deleted_at = NOW() WHERE id = $1 AND user_id = $2',
    [notificationId, userId]
  );
}

async function getUnreadCount(userId) {
  const res = await pool.query(
    'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = FALSE AND deleted_at IS NULL',
    [userId]
  );
  return parseInt(res.rows[0].count, 10);
}

module.exports = {
  send,
  get,
  markRead,
  markAllRead,
  deleteNotification,
  getUnreadCount,
};
