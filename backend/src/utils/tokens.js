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

module.exports = {
  hashToken,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getAccessSecret,
  getRefreshSecret,
};
