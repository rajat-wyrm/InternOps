const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Cache secrets at module load — avoids re-reading config on every request.
let _accessSecret = null;
let _refreshSecret = null;

function getAccessSecret() {
  if (!_accessSecret) {
    const secret = config.jwt?.secret;
    if (!secret) throw new Error('JWT_SECRET is not configured');
    _accessSecret = secret;
  }
  return _accessSecret;
}

function getRefreshSecret() {
  if (!_refreshSecret) {
    const secret = config.jwt?.refreshSecret;
    if (!secret) throw new Error('JWT_REFRESH_SECRET is not configured');
    _refreshSecret = secret;
  }
  return _refreshSecret;
}

function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      departmentId: user.department_id,
      typ: 'access',
      jti: crypto.randomUUID(),
    },
    getAccessSecret(),
    {
      expiresIn: config.jwt.accessExpiry || '15m',
    }
  );
}

function generateImpersonationAccessToken(user, admin) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      departmentId: user.department_id,
      typ: 'access',
      jti: crypto.randomUUID(),
      impersonatedBy: admin.id,
      impersonationReadOnly: true,
    },
    getAccessSecret(),
    { expiresIn: '10m' }
  );
}
function generateRefreshToken(user) {
  return jwt.sign(
    {
      id: user.id,
      jti: crypto.randomUUID(),
      typ: 'refresh',
    },
    getRefreshSecret(),
    {
      expiresIn: config.jwt.refreshExpiry || '7d',
    }
  );
}

function verifyAccessToken(t) {
  const decoded = jwt.verify(t, getAccessSecret(), {
    algorithms: ['HS256'],
  });

  if (!decoded.typ || decoded.typ !== 'access') {
    throw new Error('Token type mismatch: expected access');
  }

  return decoded;
}
function verifyRefreshToken(t) {
  const decoded = jwt.verify(t, getRefreshSecret(), {
    algorithms: ['HS256'],
  });

  if (!decoded.typ || decoded.typ !== 'refresh') {
    throw new Error('Token type mismatch: expected refresh');
  }

  return decoded;
}

function getRefreshRecoveryEncryptionKey() {
  return crypto
    .createHash('sha256')
    .update(`internops-refresh-recovery:${getRefreshSecret()}`)
    .digest();
}

function encryptRefreshRecovery(payload) {
  const iv = crypto.randomBytes(12);
  const key = getRefreshRecoveryEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  const authenticationTag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    authenticationTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

function decryptRefreshRecovery(value) {
  const parts = String(value || '').split('.');

  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid refresh recovery payload');
  }

  const key = getRefreshRecoveryEncryptionKey();
  const iv = Buffer.from(parts[1], 'base64url');
  const authenticationTag = Buffer.from(parts[2], 'base64url');
  const ciphertext = Buffer.from(parts[3], 'base64url');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

  decipher.setAuthTag(authenticationTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString('utf8'));
}

module.exports = {
  hashToken,
  generateAccessToken,
  generateImpersonationAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getAccessSecret,
  getRefreshSecret,
  encryptRefreshRecovery: encryptRefreshRecovery,
  decryptRefreshRecovery: decryptRefreshRecovery,
};
