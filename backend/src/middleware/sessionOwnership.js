const pool = require('../config/db');
const { getRedisClient } = require('../config/redis');

function sessionOwnership(paramKey = 'sessionId') {
  return async function (req, reply) {
    const sessionId = req.params[paramKey];
    const userId = req.user.id;

    const redis = await getRedisClient();

    if (redis) {
      // Check ownership in Redis
      const storedUserId = await redis.get(`refresh_token:${sessionId}`);

      if (!storedUserId || storedUserId !== String(userId)) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      return;
    }

    // ── Postgres fallback ──
    const res = await pool.query(
      'SELECT 1 FROM refresh_tokens WHERE id=$1 AND user_id=$2 LIMIT 1',
      [sessionId, userId]
    );

    if (res.rowCount === 0) {
      return reply.status(404).send({ error: 'Session not found' });
    }
  };
}

module.exports = sessionOwnership;
