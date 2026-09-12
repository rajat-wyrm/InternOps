const argon2 = require('argon2');
const { UnauthorizedError } = require('../../utils/errors');
const repo = require('./repository');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken,
} = require('../../utils/tokens');
const { createAuditLog } = require('../../utils/audit');
const {
  recordLoginAttempt,
  clearFailedAttempts,
  checkAndRecordAttempt,
} = require('../../middleware/bruteForce');
const { isValidStep } = require('../../utils/hierarchy');
const { sendVerificationEmail } = require('./verificationService');
const { blacklistAccessToken } = require('../../config/redis');
const { notifyAdmin } = require('../notifications/repository');

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
    // Re-throw genuine lockouts (statusCode 429 or 'locked' message)
    if (
      (err instanceof UnauthorizedError || err.statusCode === 429) &&
      err.message.includes('locked')
    ) {
      err.statusCode = 429;
      throw err;
    }
    // Graceful degradation: Redis infrastructure failures should not prevent login
    console.warn(
      'Brute-force check skipped due to Redis failure:',
      err.message
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

async function refreshTokens(token, ip) {
  let decoded;

  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const hash = hashToken(token);

  const claimedUserId = await repo.claimRefreshToken(hash);

  if (!claimedUserId) {
    throw new UnauthorizedError('Token revoked/expired');
  }

  if (String(claimedUserId) !== String(decoded.id)) {
    await repo.revokeAllUserTokensRedis(claimedUserId);
    throw new UnauthorizedError('Invalid refresh token');
  }

  const user = await repo.findById(claimedUserId);

  if (!user || user.suspended) {
    await repo.revokeAllUserTokensRedis(claimedUserId);
    throw new UnauthorizedError('User not found/suspended');
  }

  const newAccess = generateAccessToken(user);
  const newRefresh = generateRefreshToken(user);
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await repo.revokeAllUserTokensRedis(user.id);
  await repo.storeRefreshTokenRedis(user.id, hashToken(newRefresh), newExpiry);

  return {
    accessToken: newAccess,
    refreshToken: newRefresh,
    user: publicUser(user),
  };
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

module.exports = { register, login, refreshTokens, logout };
