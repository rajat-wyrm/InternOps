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
// WHY: Ensure both Redis and Postgres stores are updated, and avoid a
// TOCTOU race in the Redis path by combining the ownership check and the
// delete into a single atomic Lua script rather than GET-then-DEL.
// The Postgres side stays a soft revoke (UPDATE revoked = TRUE), not a
// hard DELETE, so revoked sessions remain in the audit trail (#507).
async function revokeSession(sessionId, userId) {
  const redis = await getRedisClient();
  let redisSuccess = false;

  if (redis) {
    try {
      // Atomic Lua script: verify ownership AND delete in a single operation.
      const script = `
        local key = KEYS[1]
        local userId = ARGV[1]
        local stored = redis.call('GET', key)
        if not stored then
          return 0
        end
        local ok, parsed = pcall(cjson.decode, stored)
        local storedUserId = nil
        if ok and parsed and parsed.userId then
          storedUserId = tostring(parsed.userId)
        elseif ok and parsed and parsed.user_id then
          storedUserId = tostring(parsed.user_id)
        end
        -- Fallback: plain-text token stored as just the userId
        if not storedUserId then
          storedUserId = stored
        end
        if storedUserId ~= userId then
          return 0
        end
        redis.call('DEL', key)
        redis.call('SREM', 'user_tokens:' .. userId, ARGV[2])
        return 1
      `;
      const result = await redis.eval(script, {
        keys: [`refresh_token:${sessionId}`],
        arguments: [String(userId), sessionId],
      });
      redisSuccess = result === 1;
    } catch (err) {
      console.error(
        `Failed to clean up Redis session ${sessionId} for user ${userId}:`,
        err
      );
    }
  }

  // Update Postgres — soft revoke, preserves the row for audit purposes.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      sessionId
    );
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

  return redisSuccess || pgRes.rowCount > 0;
}

// ─── revokeAllUserSessions ───────────────────────────────────────────────────
// WHY: Postgres is the source of truth and must always commit the revocation,
// even if Redis is unreachable. Redis cleanup is deliberately kept OUTSIDE
// the Postgres transaction and wrapped in its own try/catch so a Redis
// failure can never roll back — or block — the Postgres revocation (#507).
async function revokeAllUserSessions(userId) {
  // 1. Postgres UPDATE first inside a transaction — must succeed
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE',
      [userId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // 2. Redis cleanup (best-effort)
  try {
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
  } catch (err) {
    console.error(
      `Failed to clean up Redis sessions for user ${userId} in revokeAllUserSessions:`,
      err
    );
  }
}

module.exports = {
  getUserSessions,
  revokeSession,
  revokeAllUserSessions,
};
