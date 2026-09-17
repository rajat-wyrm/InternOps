const emailService = require('../../services/email');
const repo = require('./verificationRepository');
const { BadRequestError } = require('../../utils/errors');

async function sendVerificationEmail(userId, email) {
  const token = await repo.createVerificationToken(userId);
  await emailService.sendAccountVerification(email, token);
}

async function verifyEmail(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new BadRequestError('Verification token is required');
  }
  const record = await repo.consumeEmailVerificationToken(rawToken);
  if (!record) {
    throw new BadRequestError('Invalid or expired verification token');
  }
  await repo.setEmailVerified(record.user_id);
  return record;
}

module.exports = { sendVerificationEmail, verifyEmail };
