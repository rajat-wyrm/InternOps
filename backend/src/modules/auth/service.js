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
  incrementAttempt,
} = require('../../middleware/bruteForce');
const { isValidStep } = require('../../utils/hierarchy');
const { sendVerificationEmail } = require('./verificationService');
const { blacklistAccessToken } = require('../../config/redis');

const DUMMY_USER = {
  password_hash:
    '$argon2id$v=19$m=65536,t=3,p=4$8/VvKJehP9DGKtV1NP5p8g$z0S2q7BsbH2YY16pI0/jXvgI4ElwnccjvW3NNcCSsQk',
};
const { getRedisClient } = require('../../config/redis');
const emailService = require('../../services/email');

async function register(data, creator) {
  // Default to the creator (admin) as manager if none was explicitly chosen,
  // so users created via Admin > Users also show up in team/hierarchy views.
  const managerId =
    data.role === 'ADMIN'
      ? data.managerId || null
      : data.managerId || creator.id;

  if (managerId) {
    const manager = await repo.findByIdRaw(managerId);
    if (!manager) throw new Error('Manager not found');
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
    fullName: user.full_name,
  };
}
async function login(email, password, ip, userAgent) {
  let currentAttempts;

  // Step 1: Increment Redis counter
  try {
    currentAttempts = (await incrementAttempt(email, ip)) || 0;
  } catch (err) {
    console.error('Redis Brute Force Check Failed:', err);

    throw new UnauthorizedError(
      'Login temporarily unavailable. Please try again later.'
    );
  }

  // Step 2: If already locked, send notification once
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

    throw new UnauthorizedError(
      'Account temporarily locked. Please try again later.'
    );
  }

  // Step 3: Find user
  const user = await repo.findByEmail(email);

  // Step 4: Invalid user
  if (!user || user.suspended) {
    const argon2 = require('argon2');

    await argon2.verify(DUMMY_HASH, password).catch(() => {});

    await recordLoginAttempt(email, ip, false).catch(() => {});

    throw new UnauthorizedError('Invalid credentials');
  }

  // Step 5: Verify password
  const valid = await repo.verifyPassword(user, password);

  if (!valid) {
    await recordLoginAttempt(email, ip, false).catch(() => {});

    throw new UnauthorizedError('Invalid credentials');
  }

  // Step 6: Successful login
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

  // Atomic claim — if two concurrent requests race, only one gets a userId back.
  // The second gets null and is rejected immediately, eliminating the TOCTOU window.
  const claimedUserId = await repo.claimRefreshToken(hash);

  if (!claimedUserId) {
    throw new UnauthorizedError('Token revoked/expired');
  }

  // Ensure the claimed token belongs to the same user identified by the
  // signed refresh token payload.
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

  // Revoke every existing refresh token for this user before storing the
  // replacement. This prevents stolen sibling tokens from remaining usable.
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
