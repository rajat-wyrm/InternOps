const pool = require('../../config/db');
const crypto = require('crypto');
const argon2 = require('argon2');
const { revokeAllUserTokensRedis } = require('./repository');
async function createResetToken(userId) {
  // Remove old unused tokens for this user
  await pool.query(
    'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE',
    [userId]
  );
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await pool.query(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
    [userId, tokenHash, expires]
  );
  return token; // return raw token (not hashed) for email
}

async function verifyResetToken(rawToken) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const res = await pool.query(
    'SELECT * FROM password_reset_tokens WHERE token_hash = $1 AND used = FALSE AND expires_at > NOW()',
    [hash]
  );
  return res.rows[0] || null;
}

async function markTokenUsed(rawToken) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await pool.query(
    'UPDATE password_reset_tokens SET used = TRUE WHERE token_hash = $1',
    [hash]
  );
}

async function updateUserPassword(userId, newPassword) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const hash = await argon2.hash(newPassword);

    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, userId]
    );

    // Revoke all refresh tokens to force re-login
    await client.query(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1',
      [userId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Revoke all Redis-cached active tokens to prevent session hijacking
  await revokeAllUserTokensRedis(userId);
}

// Atomic password reset: lock the token row, mark it used, and update the
// password inside a single transaction so concurrent requests cannot reuse a
// single reset token.
async function resetPasswordAtomic(rawToken, newPassword) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const tokenRes = await client.query(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = $1
         AND used = FALSE
         AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash]
    );

    if (tokenRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const tokenRecord = tokenRes.rows[0];
    await client.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE id = $1',
      [tokenRecord.id]
    );

    const userId = tokenRecord.user_id;
    const hash = await argon2.hash(newPassword);

    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, userId]
    );
    await client.query(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1',
      [userId]
    );

    await client.query('COMMIT');

    // Best-effort Redis cleanup after the DB commit.
    await revokeAllUserTokensRedis(userId).catch(() => {});

    return userId;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function getResetAttemptState(email) {
  const last = await pool.query(
    `SELECT attempted_at FROM password_reset_attempts
     WHERE email = $1 ORDER BY attempted_at DESC LIMIT 1`,
    [email]
  );
  const count = await pool.query(
    `SELECT COUNT(*) AS count FROM password_reset_attempts
     WHERE email = $1 AND attempted_at > NOW() - INTERVAL '1 hour'`,
    [email]
  );
  return {
    lastAttempt: last.rows[0]?.attempted_at || null,
    hourlyCount: parseInt(count.rows[0].count, 10) || 0,
  };
}

async function recordResetAttempt(email) {
  await pool.query('INSERT INTO password_reset_attempts (email) VALUES ($1)', [
    email,
  ]);
}

module.exports = {
  createResetToken,
  verifyResetToken,
  markTokenUsed,
  updateUserPassword,
  resetPasswordAtomic,
  getResetAttemptState,
  recordResetAttempt,
};
