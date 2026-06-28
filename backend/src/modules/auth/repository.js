const pool = require('../../config/db');
const argon2 = require('argon2');

async function findByIdRaw(id) {
  const res = await pool.query(
    'SELECT id, role FROM users WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return res.rows[0] || null;
}

async function listUsersByRole(role) {
  return pool.query(
    'SELECT id,email,role,full_name,suspended FROM users WHERE deleted_at IS NULL AND role=$1',
    [role]
  );
}

async function createUser(data) {
  const passwordHash = await argon2.hash(data.password);
  const res = await pool.query(
    `INSERT INTO users (email, password_hash, role, manager_id, department_id, full_name)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, role, full_name, manager_id, department_id, created_at`,
    [
      data.email.trim().toLowerCase(),
      passwordHash,
      data.role,
      data.managerId || null,
      data.departmentId || null,
      data.fullName || null,
    ]
  );
  return res.rows[0];
}

async function findByEmail(email) {
  const res = await pool.query(
    'SELECT * FROM users WHERE LOWER(email)=LOWER($1) AND deleted_at IS NULL',
    [email]
  );
  return res.rows[0] || null;
}

async function findById(id) {
  const res = await pool.query(
    'SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL',
    [id]
  );
  return res.rows[0] || null;
}

async function verifyPassword(user, password) {
  return argon2.verify(user.password_hash, password);
}

async function storeRefreshToken(userId, tokenHash, expiresAt) {
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
    [userId, tokenHash, expiresAt]
  );
}

async function revokeRefreshToken(tokenHash) {
  await pool.query(
    'UPDATE refresh_tokens SET revoked=TRUE WHERE token_hash=$1',
    [tokenHash]
  );
}

async function revokeAllUserTokens(userId) {
  await pool.query('UPDATE refresh_tokens SET revoked=TRUE WHERE user_id=$1', [
    userId,
  ]);
}

async function updatePassword(userId, newHash) {
  await pool.query(
    'UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2',
    [newHash, userId]
  );
}

// User-editable profile columns that exist in the users schema.
const PROFILE_FIELDS = [
  'full_name',
  'phone',
  'college',
  'course',
  'year_of_study',
  'position',
  'joining_date',
  'internship_status',
  'location',
  'notes',
  'avatar_url',
];

async function updateProfile(userId, fields) {
  const set = [];
  const vals = [];
  let idx = 1;
  for (const [key, val] of Object.entries(fields)) {
    if (PROFILE_FIELDS.includes(key)) {
      set.push(`${key} = $${idx}`);
      vals.push(val);
      idx++;
    }
  }
  if (set.length === 0) {
    throw new Error('No valid fields provided for profile update');
  }
  vals.push(userId);
  await pool.query(
    `UPDATE users SET ${set.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
    vals
  );
}

// Redis integration fallback functions
const { getRedisClient } = require('../../config/redis');

async function storeRefreshTokenRedis(userId, tokenHash, expiresAt) {
  const redis = await getRedisClient();
  if (redis) {
    const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    await redis.set(
      `refresh_token:${tokenHash}`,
      JSON.stringify({ userId, createdAt: Date.now() }),
      { EX: ttl }
    );
    await redis.sAdd(`user_tokens:${userId}`, tokenHash);
  }
  // ALWAYS persist to the primary database so a Redis flush / restart
  // doesn't wipe every active session. Redis is a cache, not the source
  // of truth (#392).
  await storeRefreshToken(userId, tokenHash, expiresAt);
}

async function getRefreshTokenRedis(tokenHash) {
  const redis = await getRedisClient();

  if (redis) {
    const raw = await redis.get(`refresh_token:${tokenHash}`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return { user_id: parsed.userId };
    } catch {
      // Legacy fallback: plain string stored before JSON format was introduced
      return { user_id: raw };
    }
  }

  const res = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token_hash=$1 AND revoked=FALSE AND expires_at>NOW()',
    [tokenHash]
  );

  return res.rows[0] || null;
}

async function validateRefreshToken(tokenHash) {
  const redis = await getRedisClient();
  if (redis) {
    const userId = await redis.get(`refresh_token:${tokenHash}`);
    if (userId) return true;
  }
  const { rows } = await pool.query(
    'SELECT 1 FROM refresh_tokens WHERE token_hash=$1 AND revoked=FALSE AND expires_at>NOW()',
    [tokenHash]
  );
  return rows.length > 0;
}

// Atomically claim a refresh token — returns userId string if claimed, null if
// already used/revoked (race condition or replay attack).
async function claimRefreshToken(tokenHash) {
  const redis = await getRedisClient();
  if (redis) {
    // Lua script: GET then DEL only if key still exists — atomic, no TOCTOU.
    const lua = `
      local val = redis.call('GET', KEYS[1])
      if val then
        redis.call('DEL', KEYS[1])
        return val
      end
      return false
    `;
    const raw = await redis.eval(lua, {
      keys: [`refresh_token:${tokenHash}`],
      arguments: [],
    });
    if (!raw) return null;
    try {
      return JSON.parse(raw).userId;
    } catch {
      return raw; // legacy plain-string fallback
    }
  }
  // Postgres fallback: atomic UPDATE — only one concurrent request can flip
  // revoked=FALSE → TRUE; the second gets 0 rows back.
  const { rows } = await pool.query(
    `UPDATE refresh_tokens
     SET revoked = TRUE
     WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash]
  );
  return rows[0]?.user_id ?? null;
}

async function revokeRefreshTokenRedis(tokenHash) {
  const redis = await getRedisClient();
  if (redis) {
    const raw = await redis.get(`refresh_token:${tokenHash}`);
    if (raw) {
      let actualUserId;
      try {
        actualUserId = JSON.parse(raw).userId;
      } catch {
        actualUserId = raw; // legacy plain-string fallback
      }
      await redis.del(`refresh_token:${tokenHash}`);
      await redis.sRem(`user_tokens:${actualUserId}`, tokenHash); // ✅ correct key
    }
  }
  await revokeRefreshToken(tokenHash);
}

async function revokeAllUserTokensRedis(userId) {
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

module.exports = {
  createUser,
  findByEmail,
  findById,
  findByIdRaw,
  listUsersByRole,
  verifyPassword,
  storeRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  updatePassword,
  updateProfile,
  storeRefreshTokenRedis,
  revokeRefreshTokenRedis,
  revokeAllUserTokensRedis,
  getRefreshTokenRedis,
  validateRefreshToken,
  claimRefreshToken,
};
