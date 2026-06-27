const pool = require('../../config/db');

async function send(userId, message) {
  const res = await pool.query(
    'INSERT INTO notifications (user_id, message) VALUES ($1,$2) RETURNING *',
    [userId, message]
  );
  try {
    const { notifyUser } = require('../../websocket');
    const unread = await getUnreadCount(userId);
    await notifyUser(userId, 'notification-received', {
      notification: res.rows[0],
      unreadCount: unread,
    });
  } catch (err) {
    console.error('[Websocket Notify] Error:', err.message);
  }
}

async function get(userId, { page = 1, limit = 20 } = {}) {
  // Defensive coercion — the route schema normally guarantees integers
  // but repository callers can pass raw values from anywhere.
  const safeLim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safeLim;

  const res = await pool.query(
    `SELECT *, COUNT(*) OVER() AS total_count
     FROM notifications
     WHERE user_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, safeLim, offset]
  );

  // When the result set is empty, total_count is unavailable — default to 0
  // so callers can still render pagination without a TypeError.
  const total =
    res.rows.length > 0 ? parseInt(res.rows[0].total_count, 10) || 0 : 0;

  return {
    data: res.rows.map(({ total_count, ...row }) => row),
    total,
    page: safePage,
    limit: safeLim,
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
  const res = await pool.query(
    'UPDATE notifications SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
    [notificationId, userId]
  );
  if (res.rowCount === 0) {
    // Caller (route layer) is expected to translate this into 404. The
    // repository is the single source of truth for "did anything happen?".
    throw new Error('Notification not found or does not belong to this user');
  }
  return res.rowCount;
}
async function deleteAllNotifications(userId) {
  await pool.query(
    'UPDATE notifications SET deleted_at = NOW() WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
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
  deleteAllNotifications,
  getUnreadCount,
};
