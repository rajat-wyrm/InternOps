const pool = require('../../config/db');
const { getRedisClient } = require('../../config/redis');

// ─── getUserSessions ──────────────────────────────────────────────────────────
// WHY: The original only queried Postgres refresh_tokens. When Redis is active,
// tokens are stored in Redis (refresh_token:<hash> + user_tokens:<userId> set)
// and the Postgres table is never written to — so the query always returned [].
// FIX: Check Redis first. If available, read the user's token set and map each
// surviving hash to a session object. Fall back to Postgres when Redis is off.
async function getUserSessions(userId) {
  const redis = await getRedisClient();

  if (redis) {
    const tokenHashes = await redis.sMembers(`user_tokens:${userId}`);
    const sessions = [];
    for (const hash of tokenHashes) {
      const raw = await redis.get(`refresh_token:${hash}`);
      if (raw) {
        let createdAt = 'N/A';
        try {
          const parsed = JSON.parse(raw);
          if (parsed.createdAt) {
            createdAt = new Date(parsed.createdAt).toISOString();
          }
        } catch {}
        sessions.push({
          sessionId: hash,
          createdAt,
        });
      }
    }

    // Only return if we actually found something in Redis
    if (sessions.length > 0) {
      return sessions;
    }
  }

  // If Redis was disabled OR Redis returned no sessions, fall back to Postgres
  const res = await pool.query(
    `SELECT id, token_hash, created_at, expires_at, revoked
     FROM refresh_tokens
     WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );

  return res.rows.map((row) => ({
    sessionId: row.id,
    createdAt: row.created_at || 'N/A', // Handle Postgres dates safely too
    expiresAt: row.expires_at,
  }));
}

// ─── revokeSession ────────────────────────────────────────────────────────────
// WHY: The original ran UPDATE refresh_tokens … WHERE id = $1. In Redis mode
// the session ID is a token hash (not a UUID), and the row doesn't exist in
// Postgres — so the update silently matched 0 rows and returned false every time.
// FIX: In Redis mode, use the sessionId as a hash key. Delete the
// refresh_token:<hash> entry and remove it from the user's set.
async function revokeSession(sessionId, userId) {
  const redis = await getRedisClient();

  if (redis) {
    // Confirm the token belongs to this user before deleting
    const storedUserId = await redis.get(`refresh_token:${sessionId}`);
    if (!storedUserId || storedUserId !== String(userId)) return false;

    await redis.del(`refresh_token:${sessionId}`);
    await redis.sRem(`user_tokens:${userId}`, sessionId);
    return true;
  }

  // ── Postgres fallback ──────────────────────────────────────────────────────
  const res = await pool.query(
    'UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1 AND user_id = $2 RETURNING id',
    [sessionId, userId]
  );
  return res.rowCount > 0;
}

async function revokeAllUserSessions(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Revoke all refresh tokens for the user in Postgres
    await client.query(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE',
      [userId]
    );

    // Revoke from Redis atomically
    const redis = await getRedisClient();
    if (redis) {
      const tokens = await redis.sMembers(`user_tokens:${userId}`);
      if (tokens.length > 0) {
        const multi = redis.multi();
        for (const token of tokens) {
          multi.del(`refresh_token:${token}`);
        }
        multi.del(`user_tokens:${userId}`);
        await multi.exec();
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getUserSessions, revokeSession, revokeAllUserSessions };
