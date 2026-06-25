const { BadRequestError } = require('../../utils/errors');
const repo = require('./resetRepository');
const userRepo = require('./repository');
const emailService = require('../../services/email');
const { createAuditLog, extractRequestInfo } = require('../../utils/audit');
const RESET_COOLDOWN_MS = 60 * 1000; // 1 minute between reset requests per email
const RESET_HOURLY_LIMIT = 5; // per email

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
    Date.now() - new Date(state.lastAttempt).getTime() < RESET_COOLDOWN_MS
  ) {
    return;
  }
  if (state.hourlyCount >= RESET_HOURLY_LIMIT) {
    return;
  }

  const token = await repo.createResetToken(user.id);
  await emailService.sendPasswordReset(email, token);

  await repo.recordResetAttempt(email);
  await createAuditLog({
    userId: user.id,
    action: 'PASSWORD_RESET_REQUESTED',
    resourceType: 'user',
    resourceId: user.id,
    ...requestInfo,
  });
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
