const { BadRequestError } = require('../../utils/errors');
const repo = require('./resetRepository');
const userRepo = require('./repository');
const emailService = require('../../services/email');
const { createAuditLog, extractRequestInfo } = require('../../utils/audit');

async function forgotPassword(email, requestInfo) {
  const user = await userRepo.findByEmail(email);
  if (!user) {
  return;
}
  const token = await repo.createResetToken(user.id);
  await emailService.sendPasswordReset(email, token);
  await createAuditLog({
    userId: user.id,
    action: 'PASSWORD_RESET_REQUESTED',
    resourceType: 'user',
    resourceId: user.id,
    ...requestInfo,
  });
}

async function resetPassword(token, newPassword, requestInfo) {
  const userId = await repo.resetPasswordAtomic(
    token,
    newPassword
  );

  await createAuditLog({
    userId,
    action: 'PASSWORD_RESET_COMPLETED',
    resourceType: 'user',
    resourceId: userId,
    ...requestInfo,
  });
}
module.exports = { forgotPassword, resetPassword };
