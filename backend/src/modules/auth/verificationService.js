const emailService = require('../../services/email');
const repo = require('./verificationRepository');

async function sendVerificationEmail(userId, email) {
  const token = await repo.createVerificationToken(userId);
  await emailService.sendAccountVerification(email, token);
}

async function verifyEmail(rawToken) {
  const record = await repo.verifyEmailToken(rawToken);
  if (!record) throw new Error('Invalid or expired verification token');
  await repo.markTokenUsed(rawToken);
  await repo.setEmailVerified(record.user_id);
  return record;
}

module.exports = { sendVerificationEmail, verifyEmail };
