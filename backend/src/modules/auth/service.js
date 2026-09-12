const crypto = require('crypto');
const argon2 = require('argon2');
const { UnauthorizedError } = require('../../utils/errors');
const repo = require('./repository');
const {
  generateAccessToken,
  generateImpersonationAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken,
  encryptRefreshRecovery,
  decryptRefreshRecovery,
} = require('../../utils/tokens');
const { createAuditLog } = require('../../utils/audit');
const {
  recordLoginAttempt,
  clearFailedAttempts,
  checkAndRecordAttempt,
  incrementAttempt,
} = require('../../middleware/bruteForce');
const { isValidStep } = require('../../utils/hierarchy');
const { sendVerificationEmail } = require('./verificationService');
const { blacklistAccessToken } = require('../../config/redis');
const { notifyAdmin } = require('../notifications/repository');

const REFRESH_RECOVERY_SECONDS = 20 * 60;

const DUMMY_USER = {
  password_hash:
    '$argon2id$v=19$m=65536,t=3,p=4$8/VvKJehP9DGKtV1NP5p8g$z0S2q7BsbH2YY16pI0/jXvgI4ElwnccjvW3NNcCSsQk',
};

async function register(data, creator) {
  const allowedRolesByCreator = {
    ADMIN: [
      'ADMIN',
      'MANAGEMENT',
      'HR',
      'SENIOR_TL',
      'TL',
      'CAPTAIN',
      'INTERN',
    ],
    SENIOR_TL: ['TL', 'CAPTAIN', 'INTERN'],
    TL: ['CAPTAIN', 'INTERN'],
  };

  const creatorRolePolicy = allowedRolesByCreator[creator.role];

  if (creatorRolePolicy && !creatorRolePolicy.includes(data.role)) {
    const error = new Error('You cannot create a user with this role');
    error.statusCode = 403;
    throw error;
  }

  if (['SENIOR_TL', 'TL'].includes(creator.role)) {
    if (!creator.departmentId) {
      const error = new Error('Your account is not assigned to a department');
      error.statusCode = 403;
      throw error;
    }

    if (data.departmentId && data.departmentId !== creator.departmentId) {
      const error = new Error('You cannot create users in another department');
      error.statusCode = 403;
      throw error;
    }

    data = { ...data, departmentId: creator.departmentId };
  }

  const managerId =
    data.role === 'ADMIN'
      ? data.managerId || null
      : data.managerId || creator.id;

  if (managerId) {
    const manager = await repo.findByIdRaw(managerId);
    if (!manager) throw new Error('Manager not found');

    if (
      creator.role !== 'ADMIN' &&
      manager.department_id !== creator.departmentId
    ) {
      const error = new Error('Manager must belong to your department');
      error.statusCode = 403;
      throw error;
    }

    if (!isValidStep(manager.role, data.role)) {
      throw new Error(
        `Invalid hierarchy: ${manager.role} cannot manage ${data.role}`
      );
    }
  }

  const user = await repo.createUser({ ...data, managerId });

  await createAuditLog({
    userId: creator.id,
    action: 'USER_CREATED',
    resourceType: 'user',
    resourceId: user.id,
    details: { email: user.email, role: user.role },
  });

  sendVerificationEmail(user.id, user.email).catch((err) =>
    console.error('[Verification] Failed to send:', err.message)
  );

  return user;
}

const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXJhbmRvbXNhbHQ$RdescudvJCsgt3ub+b27Ze4AXpxcKAspe5gOjBosC2o';

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    full_name: user.full_name,
    mustChangePassword: Boolean(user.must_change_password),
  };
}

async function login(email, password, ip, userAgent) {
  try {
    await checkAndRecordAttempt(email, ip);
  } catch (err) {
    if (
      (err instanceof UnauthorizedError || err.statusCode === 429) &&
      (err.statusCode === 429 ||
        (err.message && err.message.includes('locked')))
    ) {
      err.statusCode = 429;
      err.status = 429;
      throw err;
    }

    throw new UnauthorizedError(
      'Login temporarily unavailable. Please try again later.'
    );
  }

  const user = await repo.findByEmail(email);

  if (!user || user.suspended) {
    await argon2.verify(DUMMY_HASH, password).catch(() => {});
    await recordLoginAttempt(email, ip, false).catch(() => {});

    const issueType = user?.suspended
      ? 'Account Suspended'
      : 'Login Failed - User Not Found';
    notifyAdmin(
      `⚠️ User Issue: ${issueType}\nUser: ${email}\nTime: ${new Date().toLocaleString()}`
    ).catch(() => {});

    throw new UnauthorizedError('Invalid credentials');
  }

  const valid = await repo.verifyPassword(user, password);

  if (!valid) {
    await recordLoginAttempt(email, ip, false).catch(() => {});

    notifyAdmin(
      `⚠️ User Issue: Login Failed\nUser: ${email}\nIssue: Invalid password\nTime: ${new Date().toLocaleString()}`
    ).catch(() => {});

    throw new UnauthorizedError('Invalid credentials');
  }

  await clearFailedAttempts(email, ip);
  await recordLoginAttempt(email, ip, true);

  const access = generateAccessToken(user);
  const refresh = generateRefreshToken(user);
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await repo.storeRefreshTokenRedis(user.id, hashToken(refresh), expires);

  return {
    accessToken: access,
    refreshToken: refresh,
    user: publicUser(user),
  };
}

async function refreshTokens(token, ip, userAgent) {
  let decoded;

  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const userId = decoded.id;
  const user = await repo.findById(userId);

  if (!user || user.suspended) {
    throw new UnauthorizedError('User not found/suspended');
  }

  const consumedTokenHash = hashToken(token);
  const newAccess = generateAccessToken(user);
  const newRefresh = generateRefreshToken(user);
  const replacementTokenHash = hashToken(newRefresh);
  const replacementExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const recoveryExpiresAt = new Date(
    Date.now() + REFRESH_RECOVERY_SECONDS * 1000
  );

  const responsePayload = {
    accessToken: newAccess,
    refreshToken: newRefresh,
    user: publicUser(user),
  };

  const clientFingerprint = crypto
    .createHash('sha256')
    .update(`${ip}|${userAgent}`)
    .digest('hex');
  const encryptedPayload = encryptRefreshRecovery(responsePayload);

  let rotationResult = null;
  try {
    rotationResult = await repo.rotateRefreshTokenWithRecovery({
      consumedTokenHash,
      userId: user.id,
      replacementTokenHash,
      replacementExpiresAt,
      clientFingerprint,
      encryptedPayload,
      recoveryExpiresAt,
    });
  } catch (err) {
    // ignore DB errors during mock / fallback
  }

  if (rotationResult && rotationResult.rotated) {
    await repo.cacheRefreshToken(
      user.id,
      replacementTokenHash,
      replacementExpiresAt
    );
    return responsePayload;
  }

  const recovery = await repo.getRefreshRecoveryPostgres(consumedTokenHash);
  if (!recovery) {
    throw new UnauthorizedError('Token revoked/expired');
  }

  if (recovery.client_fingerprint !== clientFingerprint) {
    throw new UnauthorizedError('Token revoked/expired');
  }

  let recoveredSession;
  try {
    recoveredSession = decryptRefreshRecovery(recovery.encrypted_payload);
  } catch {
    throw new UnauthorizedError('Token revoked/expired');
  }

  return recoveredSession;
}

async function logout(
  token,
  authenticatedUserId,
  accessJti,
  accessExp,
  ip,
  userAgent
) {
  let decoded;

  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  if (String(decoded.id) !== String(authenticatedUserId)) {
    throw new UnauthorizedError('Token does not belong to authenticated user');
  }

  await repo.revokeRefreshTokenRedis(hashToken(token));

  const ttl = accessExp - Math.floor(Date.now() / 1000);

  if (ttl > 0) {
    await blacklistAccessToken(accessJti, ttl);
  }

  await createAuditLog({
    userId: authenticatedUserId,
    action: 'LOGOUT',
    resourceType: 'auth',
    resourceId: authenticatedUserId,
    ipAddress: ip,
    userAgent,
  });
}

async function startImpersonation(
  admin,
  targetUserId,
  password,
  reason,
  ip,
  userAgent
) {
  if (!admin || admin.role !== 'ADMIN') {
    throw new UnauthorizedError('Only admins can initiate user view');
  }

  const adminUser = await repo.findById(admin.id);
  if (!adminUser || adminUser.suspended) {
    throw new UnauthorizedError('Admin account unavailable');
  }

  const validPassword = await repo.verifyPassword(adminUser, password);
  if (!validPassword) {
    throw new UnauthorizedError('Invalid admin password');
  }

  const target = await repo.findById(targetUserId);
  if (!target || target.suspended) {
    throw new UnauthorizedError('Target user unavailable');
  }

  if (target.role === 'ADMIN') {
    throw new UnauthorizedError('Cannot impersonate another admin user');
  }

  const accessToken = generateImpersonationAccessToken(target, admin);

  await createAuditLog({
    userId: admin.id,
    action: 'IMPERSONATION_STARTED',
    resourceType: 'user',
    resourceId: target.id,
    ipAddress: ip,
    userAgent,
    details: { reason, targetRole: target.role },
  });

  return {
    accessToken,
    user: publicUser(target),
  };
}

async function exitImpersonation(adminId, targetUserId, ip, userAgent) {
  await createAuditLog({
    userId: adminId,
    action: 'IMPERSONATION_EXITED',
    resourceType: 'user',
    resourceId: targetUserId,
    ipAddress: ip,
    userAgent,
  });
}

module.exports = {
  register,
  login,
  refreshTokens,
  logout,
  startImpersonation,
  exitImpersonation,
  createUser: repo.createUser,
  findByEmail: repo.findByEmail,
  findById: repo.findById,
  findByIdRaw: repo.findByIdRaw,
  getPasswordAccessState: repo.getPasswordAccessState,
  listUsersByRole: repo.listUsersByRole,
  verifyPassword: repo.verifyPassword,
  storeRefreshToken: repo.storeRefreshToken,
  revokeRefreshToken: repo.revokeRefreshToken,
  revokeAllUserTokens: repo.revokeAllUserTokens,
  updatePassword: repo.updatePassword,
  updateProfile: repo.updateProfile,
  storeRefreshTokenRedis: repo.storeRefreshTokenRedis,
  revokeRefreshTokenRedis: repo.revokeRefreshTokenRedis,
  revokeAllUserTokensRedis: repo.revokeAllUserTokensRedis,
  getRefreshTokenRedis: repo.getRefreshTokenRedis,
  validateRefreshToken: repo.validateRefreshToken,
  claimRefreshToken: repo.claimRefreshToken,
  rotateRefreshTokenWithRecovery: repo.rotateRefreshTokenWithRecovery,
  getRefreshRecoveryPostgres: repo.getRefreshRecoveryPostgres,
  cacheRefreshToken: repo.cacheRefreshToken,
};
