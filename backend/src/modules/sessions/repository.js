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

    // ... (Your existing loop code to populate the sessions array) ...

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
// WHY: Ensure both Redis and Postgres stores are updated. If Redis is active,
// delete the refresh_token:<hash> entry and remove it from the user's set.
// Then, invalidate the Postgres row by updating either the UUID id or token_hash.
async function revokeSession(sessionId, userId) {
  const redis = await getRedisClient();
  let redisSuccess = false;

  if (redis) {
    try {
      const stored = await redis.get(`refresh_token:${sessionId}`);
      if (stored) {
        let storedUserId;
        try {
          storedUserId = JSON.parse(stored).userId;
        } catch {
          storedUserId = stored;
        }
        if (String(storedUserId) === String(userId)) {
          await redis.del(`refresh_token:${sessionId}`);
          await redis.sRem(`user_tokens:${userId}`, sessionId);
          redisSuccess = true;
        }
      }
    } catch (err) {
      console.error(`Failed to clean up Redis session ${sessionId} for user ${userId}:`, err);
    }
  }

  // Update Postgres
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);
  let pgRes;
  if (isUuid) {
    pgRes = await pool.query(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1 AND user_id = $2 RETURNING id',
      [sessionId, userId]
    );
  } else {
    pgRes = await pool.query(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1 AND user_id = $2 RETURNING id',
      [sessionId, userId]
    );
  }

  return redisSuccess || (pgRes.rowCount > 0);
}

// ─── revokeAllUserSessions ───────────────────────────────────────────────────
// WHY: The original only updated Postgres or only cleared Redis. We need to
// ensure complete invalidation across both Postgres and Redis.
// FIX: First execute Postgres UPDATE to revoke all active tokens. Then, clean up
// Redis keys on a best-effort basis so that Redis failures do not abort Postgres changes.
async function revokeAllUserSessions(userId) {
  // 1. Postgres UPDATE first
  await pool.query(
    'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE',
    [userId]
  );

  // 2. Redis cleanup (best-effort)
  try {
    const redis = await getRedisClient();
    if (redis) {
      const tokens = await redis.sMembers(`user_tokens:${userId}`);
      if (tokens && tokens.length > 0) {
        await redis.del(tokens.map((token) => `refresh_token:${token}`));
      }
      await redis.del(`user_tokens:${userId}`);
    }
  } catch (err) {
    console.error(`Failed to clean up Redis sessions for user ${userId} in revokeAllUserSessions:`, err);
  }
}

module.exports = { getUserSessions, revokeSession, revokeAllUserSessions };
