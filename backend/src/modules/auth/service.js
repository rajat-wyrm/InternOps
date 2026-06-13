const { UnauthorizedError } = require('../../utils/errors');
const repo = require('./repository');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken,
} = require('../../utils/tokens');
const { createAuditLog } = require('../../utils/audit');
const { recordLoginAttempt } = require('../../middleware/bruteForce');
const { isValidStep } = require('../../utils/hierarchy');
const { sendVerificationEmail } = require('./verificationService');

async function register(data, creator) {
  if (data.managerId) {
    const pool = require('../../config/db');
    const {
      rows: [manager],
    } = await pool.query(
      'SELECT id, role FROM users WHERE id = $1 AND deleted_at IS NULL',
      [data.managerId]
    );
    if (!manager) throw new Error('Manager not found');
    if (!isValidStep(manager.role, data.role)) {
      throw new Error(
        `Invalid hierarchy: ${manager.role} cannot manage ${data.role}`
      );
    }
  }
  const user = await repo.createUser(data);
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

async function login(email, password, ip, userAgent) {
  const user = await repo.findByEmail(email);
  if (!user || user.suspended) {
    await recordLoginAttempt(email, ip, false);
    throw new UnauthorizedError('Invalid credentials or suspended');
  }
  const valid = await repo.verifyPassword(user, password);
  if (!valid) {
    await recordLoginAttempt(email, ip, false);
    throw new UnauthorizedError('Invalid credentials');
  }
  await recordLoginAttempt(email, ip, true);
  const access = generateAccessToken(user);
  const refresh = generateRefreshToken(user);
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await repo.storeRefreshTokenRedis(user.id, hashToken(refresh), expires);
  await createAuditLog({
    userId: user.id,
    action: 'LOGIN',
    ipAddress: ip,
    userAgent,
  });
  return {
    accessToken: access,
    refreshToken: refresh,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
    },
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
  const storedToken = await repo.getRefreshTokenRedis(hash);

  if (!storedToken) {
    throw new UnauthorizedError('Token revoked/expired');
  }

  await repo.revokeRefreshTokenRedis(hash);

  const user = await repo.findById(decoded.id);

  if (!user || user.suspended) {
    throw new UnauthorizedError('User not found/suspended');
  }

  const newAccess = generateAccessToken(user);
  const newRefresh = generateRefreshToken(user);
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await repo.storeRefreshTokenRedis(user.id, hashToken(newRefresh), newExpiry);

  return {
    accessToken: newAccess,
    refreshToken: newRefresh,
  };
}
async function logout(token, authenticatedUserId, ip, userAgent) {
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

  await createAuditLog({
    userId: authenticatedUserId,
    action: 'LOGOUT',
    ipAddress: ip,
    userAgent,
  });
}
module.exports = { register, login, refreshTokens, logout };
