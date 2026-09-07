const argon2 = require('argon2');
const crypto = require('crypto');
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
  incrementAttempt,
} = require('../../middleware/bruteForce');
const { isValidStep } = require('../../utils/hierarchy');
const { sendVerificationEmail } = require('./verificationService');
const { blacklistAccessToken } = require('../../config/redis');
const { notifyAdmin } = require('../notifications/repository');

const DUMMY_USER = {
  password_hash:
    '$argon2id$v=19$m=65536,t=3,p=4$8/VvKJehP9DGKtV1NP5p8g$z0S2q7BsbH2YY16pI0/jXvgI4ElwnccjvW3NNcCSsQk',
};
const { getRedisClient } = require('../../config/redis');
const emailService = require('../../services/email');

const REFRESH_RECOVERY_SECONDS = 20 * 60;

function refreshClientFingerprint(ip, userAgent) {
  return crypto
    .createHash('sha256')
    .update(`${ip || ''}|${userAgent || ''}`)
    .digest('hex');
}

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

  // Default to the creator as manager if none was explicitly chosen,
  // so users created through the directory also appear in hierarchy views.
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

// Dummy hash used to flatten timing when user doesn't exist.
// Prevents user-enumeration via response latency differences.
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
  let currentAttempts = 0;

  try {
    currentAttempts = (await incrementAttempt(email, ip)) || 0;
  } catch (err) {
    console.error('Redis Brute Force Check Failed:', err);

    throw new UnauthorizedError(
      'Login temporarily unavailable. Please try again later.'
    );
  }

  if (currentAttempts > 5) {
    const redis = await getRedisClient();
    const notifyKey = `lockout-email:${email}`;

    let alreadySent = null;

    if (redis) {
      alreadySent = await redis.get(notifyKey);
    }

    if (!alreadySent) {
      const user = await repo.findByEmail(email);

      if (user) {
        await emailService.sendAccountLockoutNotification(email, {
          ipAddress: ip,
          timestamp: new Date().toISOString(),
          failedAttempts: currentAttempts,
        });
      }

      if (redis) {
        await redis.set(notifyKey, '1', {
          EX: 15 * 60,
        });
      }
    }

    // Notify admins about account lockout (fire-and-forget)
    notifyAdmin(
      `Account Locked\nUser: ${email}\nIssue: Too many failed login attempts (${currentAttempts})\nTime: ${new Date().toLocaleString()}`
    ).catch(() => {});

    throw new UnauthorizedError(
      'Account temporarily locked. Please try again later.'
    );
  }

  const user = await repo.findByEmail(email);

  if (!user || user.suspended) {
    await argon2.verify(DUMMY_HASH, password).catch(() => {});
    await recordLoginAttempt(email, ip, false).catch(() => {});

    // Notify admins (fire-and-forget). Suspended users get a distinct message.
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

    // Notify admins about failed login (fire-and-forget)
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

  const consumedTokenHash = hashToken(token);

  const fingerprint = refreshClientFingerprint(ip, userAgent);

  const user = await repo.findById(decoded.id);

  if (!user || user.suspended) {
    await repo.revokeAllUserTokensRedis(decoded.id);

    throw new UnauthorizedError('User not found/suspended');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  const replacementTokenHash = hashToken(refreshToken);

  const publicSessionUser = publicUser(user);

  const replacementExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const recoveryExpiresAt = new Date(
    Date.now() + REFRESH_RECOVERY_SECONDS * 1000
  );

  const encryptedPayload = encryptRefreshRecovery({
    accessToken,
    refreshToken,
    user: publicSessionUser,
  });

  const rotation = await repo.rotateRefreshTokenWithRecovery({
    consumedTokenHash,
    userId: user.id,
    replacementTokenHash,
    replacementExpiresAt,
    clientFingerprint: fingerprint,
    encryptedPayload,
    recoveryExpiresAt,
  });

  if (rotation?.rotated) {
    await repo.cacheRefreshToken(
      user.id,
      replacementTokenHash,
      replacementExpiresAt
    );

    return {
      accessToken,
      refreshToken,
      user: publicSessionUser,
    };
  }

  if (
    rotation?.claimedUserId &&
    String(rotation.claimedUserId) !== String(decoded.id)
  ) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const recovery = await repo.getRefreshRecoveryPostgres(consumedTokenHash);

  const sameClient = recovery?.client_fingerprint === fingerprint;

  const sameUser = String(recovery?.user_id) === String(decoded.id);

  if (!sameClient || !sameUser) {
    throw new UnauthorizedError('Token revoked/expired');
  }

  let recovered;

  try {
    recovered = decryptRefreshRecovery(recovery.encrypted_payload);
  } catch {
    throw new UnauthorizedError('Token revoked/expired');
  }

  if (!recovered?.accessToken || !recovered?.refreshToken || !recovered?.user) {
    throw new UnauthorizedError('Token revoked/expired');
  }

  if (hashToken(recovered.refreshToken) !== recovery.replacement_token_hash) {
    throw new UnauthorizedError('Token revoked/expired');
  }

  return recovered;
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
  if (admin.role !== 'ADMIN' || admin.impersonatedBy) {
    const error = new Error(
      'Only a signed-in administrator can view as a user'
    );
    error.statusCode = 403;
    throw error;
  }
  const [adminUser, target] = await Promise.all([
    repo.findById(admin.id),
    repo.findById(targetUserId),
  ]);
  if (!adminUser || !(await repo.verifyPassword(adminUser, password))) {
    throw new UnauthorizedError('Administrator password is incorrect');
  }
  if (
    !target ||
    target.suspended ||
    target.deleted_at ||
    target.role === 'ADMIN'
  ) {
    const error = new Error('This account cannot be viewed');
    error.statusCode = target ? 403 : 404;
    throw error;
  }
  const accessToken = generateImpersonationAccessToken(target, adminUser);
  await createAuditLog({
    userId: adminUser.id,
    action: 'IMPERSONATION_STARTED',
    resourceType: 'user',
    resourceId: target.id,
    details: { reason, targetRole: target.role, readOnly: true },
    ipAddress: ip,
    userAgent,
  });
  return {
    accessToken,
    user: publicUser(target),
    impersonation: {
      admin: publicUser(adminUser),
      reason,
      expiresInSeconds: 600,
    },
  };
}
async function exitImpersonation(adminId, targetUserId, ip, userAgent) {
  await createAuditLog({
    userId: adminId,
    action: 'IMPERSONATION_EXITED',
    resourceType: 'user',
    resourceId: targetUserId,
    details: { readOnly: true },
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
};
