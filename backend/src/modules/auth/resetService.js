const { BadRequestError } = require('../../utils/errors');
const repo = require('./resetRepository');
const userRepo = require('./repository');
const emailService = require('../../services/email');
const { createAuditLog, extractRequestInfo } = require('../../utils/audit');
const config = require('../../config');

async function forgotPassword(email, requestInfo) {
  const user = await userRepo.findByEmail(email);

  if (!user) {
    // Don't reveal whether the email exists.
    return;
  }

  // Rate-limit per email to defeat email-bombing attacks. We always return
  // the same response, but suppress the actual email when over the limit.
  const state = await repo.getResetAttemptState(email);
  if (
    state.lastAttempt &&
    Date.now() - new Date(state.lastAttempt).getTime() <
      config.rateLimit.passwordResetCooldownMs
  ) {
    return;
  }
  if (state.hourlyCount >= config.rateLimit.passwordResetHourlyMax) {
    return;
  }

  const token = await repo.createResetToken(user.id);

  try {
    await emailService.sendPasswordReset(email, token);
  } catch (err) {
    // Email failure should not orphan the token or skip rate limiting (#993, #945)
    console.error('[forgotPassword] Email send failed:', err.message);
  }

  await repo.recordResetAttempt(email);
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
