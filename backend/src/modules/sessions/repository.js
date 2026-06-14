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
      // A hash still in the set but already expired/deleted won't have a key.
      const exists = await redis.get(`refresh_token:${hash}`);
      if (exists) {
        const ttl = await redis.ttl(`refresh_token:${hash}`);
        sessions.push({
          // In Redis mode the hash IS the session identifier (no UUID row).
          sessionId: hash,
          createdAt: null, // not stored in Redis
          expiresAt: new Date(Date.now() + ttl * 1000),
        });
      } else {
        // Clean up stale entry from the set
        await redis.sRem(`user_tokens:${userId}`, hash);
      }
    }

    return sessions;
  }

  // ── Postgres fallback ──────────────────────────────────────────────────────
  const res = await pool.query(
    `SELECT id, token_hash, created_at, expires_at, revoked
     FROM refresh_tokens
     WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );
  return res.rows.map((row) => ({
    sessionId: row.id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    // token_hash omitted for security
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

// ─── revokeAllUserSessions ───────────────────────────────────────────────────
// WHY: The original ran UPDATE refresh_tokens SET revoked = TRUE for all rows.
// In Redis mode there are no rows to update — all sessions survive revocation.
// FIX: In Redis mode, delete every hash in user_tokens:<userId> and the set
// itself. This is the exact same logic already used in auth/repository.js
// (revokeAllUserTokensRedis) — we replicate it here to keep sessions/
// repository.js self-contained without a circular dependency.
async function revokeAllUserSessions(userId) {
  const redis = await getRedisClient();

  if (redis) {
    const tokens = await redis.sMembers(`user_tokens:${userId}`);
    for (const token of tokens) {
      await redis.del(`refresh_token:${token}`);
    }
    await redis.del(`user_tokens:${userId}`);
    return;
  }

  // ── Postgres fallback ──────────────────────────────────────────────────────
  await pool.query(
    'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE',
    [userId]
  );
}

module.exports = { getUserSessions, revokeSession, revokeAllUserSessions };
