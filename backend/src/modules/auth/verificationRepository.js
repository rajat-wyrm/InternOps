const pool = require('../../config/db');
const crypto = require('crypto');

async function createVerificationToken(userId) {
  await pool.query(
    'UPDATE email_verifications SET used = TRUE WHERE user_id = $1 AND used = FALSE',
    [userId]
  );
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
    [userId, tokenHash, expires]
  );
  return token;
}

async function verifyEmailToken(rawToken) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const res = await pool.query(
    'SELECT * FROM email_verifications WHERE token_hash = $1 AND used = FALSE AND expires_at > NOW()',
    [hash]
  );
  return res.rows[0] || null;
}

async function markTokenUsed(rawToken) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await pool.query(
    'UPDATE email_verifications SET used = TRUE WHERE token_hash = $1',
    [hash]
  );
}

async function consumeEmailVerificationToken(rawToken) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const res = await client.query(
      `SELECT id, user_id
       FROM email_verifications
       WHERE token_hash = $1
         AND used = FALSE
         AND expires_at > NOW()
       FOR UPDATE`,
      [hash]
    );

    if (res.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const record = res.rows[0];
    await client.query(
      'UPDATE email_verifications SET used = TRUE WHERE id = $1',
      [record.id]
    );
    await client.query('COMMIT');
    return record;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function setEmailVerified(userId) {
  await pool.query(
    'UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1',
    [userId]
  );
}

module.exports = {
  createVerificationToken,
  verifyEmailToken,
  markTokenUsed,
  consumeEmailVerificationToken,
  setEmailVerified,
};
