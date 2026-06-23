const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getAccessSecret() {
  const secret = config.jwt?.secret;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

function getRefreshSecret() {
  const secret = config.jwt?.refreshSecret;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is not configured');
  }
  return secret;
}

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, typ: 'access' },
    getAccessSecret(),
    {
      expiresIn: config.jwt.expiry || '15m',
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
  const decoded = jwt.verify(t, getAccessSecret());
  if (decoded.typ && decoded.typ !== 'access') {
    throw new Error('Token type mismatch: expected access');
  }
  return decoded;
}

function verifyRefreshToken(t) {
  const decoded = jwt.verify(t, getRefreshSecret());
  if (decoded.typ && decoded.typ !== 'refresh') {
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
