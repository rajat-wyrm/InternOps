const { BadRequestError } = require('../../utils/errors');
const repo = require('./resetRepository');
const userRepo = require('./repository');
const emailService = require('../../services/email');
const { createAuditLog, extractRequestInfo } = require('../../utils/audit');
const pool = require('../../config/db');

const RESET_COOLDOWN_MS = 60 * 1000; // 1 minute between reset requests per email
const RESET_HOURLY_LIMIT = 5; // per email

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

async function forgotPassword(email, requestInfo) {
  const user = await userRepo.findByEmail(email);

  if (!user) {
    // Don't reveal whether the email exists.
    return;
  }

  // Rate-limit per email to defeat email-bombing attacks. We always return
  // the same response, but suppress the actual email when over the limit.
  const state = await getResetAttemptState(email);
  if (
    state.lastAttempt &&
    Date.now() - new Date(state.lastAttempt).getTime() < RESET_COOLDOWN_MS
  ) {
    return;
  }
  if (state.hourlyCount >= RESET_HOURLY_LIMIT) {
    return;
  }

  const token = await repo.createResetToken(user.id);
  await emailService.sendPasswordReset(email, token);

  await recordResetAttempt(email);
  return {
    userId: user.id,
    action: 'PASSWORD_RESET_REQUESTED',
    resourceType: 'user',
    resourceId: user.id,
    ...requestInfo,
  };
}

async function resetPassword(token, newPassword, requestInfo) {
  const userId = await repo.resetPasswordAtomic(token, newPassword);
  if (!userId) {
    throw new BadRequestError('Invalid or expired reset token');
  }
  return {
    userId,
    action: 'PASSWORD_RESET_COMPLETED',
    resourceType: 'user',
    resourceId: userId,
    ...requestInfo,
  };
}

module.exports = { forgotPassword, resetPassword };
