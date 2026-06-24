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
} = require('../../middleware/bruteForce');
const { isValidStep } = require('../../utils/hierarchy');
const { sendVerificationEmail } = require('./verificationService');

async function register(data, creator) {
  if (data.managerId) {
    const manager = await repo.findByIdRaw(data.managerId);
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

// Dummy hash used to flatten timing when user doesn't exist.
// Prevents user-enumeration via response latency differences.
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXJhbmRvbXNhbHQ$RdescudvJCsgt3ub+b27Ze4AXpxcKAspe5gOjBosC2o';

async function login(email, password, ip, userAgent) {
  const user = await repo.findByEmail(email);
  if (!user || user.suspended) {
    // Always run argon2.verify even when user not found to flatten timing
    const argon2 = require('argon2');
    argon2.verify(DUMMY_HASH, password).catch(() => {});
    recordLoginAttempt(email, ip, false).catch(() => {}); // fire-and-forget
    throw new UnauthorizedError('Invalid credentials');
  }
  const valid = await repo.verifyPassword(user, password);
  if (!valid) {
    await recordLoginAttempt(email, ip, false);
    throw new UnauthorizedError('Invalid credentials');
  }
  // Clear all prior failed attempts so attacker-seeded failures don't
  // trigger a lockout for the legitimate user after a successful login.
  await clearFailedAttempts(email, ip);
  await recordLoginAttempt(email, ip, true);
  const access = generateAccessToken(user);
  const refresh = generateRefreshToken(user);
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await repo.storeRefreshTokenRedis(user.id, hashToken(refresh), expires);
  // NOTE: the LOGIN audit log is intentionally NOT written here.
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

  // Atomic claim — if two concurrent requests race, only one gets a userId back.
  // The second gets null and is rejected immediately, eliminating the TOCTOU window.
  const claimedUserId = await repo.claimRefreshToken(hash);
  if (!claimedUserId) {
    throw new UnauthorizedError('Token revoked/expired');
  }

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
}
module.exports = { register, login, refreshTokens, logout };
