const pool = require('../config/db');
const { getRedisClient } = require('../config/redis');
const logger = require('../logger');
const { UnauthorizedError } = require('../utils/errors');
const repo = require('../modules/auth/repository');
const emailService = require('../services/email');
const { notifyAdmin } = require('../modules/notifications/repository');

let MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function setMaxAttempts(count) {
  MAX_ATTEMPTS = count;
}

function getMaxAttempts() {
  return MAX_ATTEMPTS;
}

async function incrementAttempt(email, ip) {
  const redis = await getRedisClient();
  if (!redis) return 0;

  const key = `brute:${email}:${ip}`;
  const count = await redis.incr(key);
  await redis.expire(key, LOCKOUT_MINUTES * 60);
  return count;
}

async function notifyLockoutOnce(email, ip) {
  const user = await repo.findByEmail(email);
  if (!user) return;

  const adminMsg = `Account Locked\nUser: ${email}\nIssue: Too many failed login attempts (${MAX_ATTEMPTS})\nTime: ${new Date().toLocaleString()}`;

  try {
    const redis = await getRedisClient();
    if (redis) {
      const notifyKey = `lockout-email:${email}`;
      const alreadySent = await redis.get(notifyKey);
      if (!alreadySent) {
        await emailService.sendAccountLockoutNotification(email, {
          ipAddress: ip,
          timestamp: new Date().toISOString(),
          failedAttempts: MAX_ATTEMPTS,
        });
        notifyAdmin(adminMsg).catch(() => {});
        await redis.set(notifyKey, '1', { EX: LOCKOUT_MINUTES * 60 });
      }
    } else {
      // Fallback if Redis is down – send once without deduplication
      await emailService.sendAccountLockoutNotification(email, {
        ipAddress: ip,
        timestamp: new Date().toISOString(),
        failedAttempts: MAX_ATTEMPTS,
      });
      notifyAdmin(adminMsg).catch(() => {});
    }
  } catch (err) {
    logger.error({ err }, 'Failed to send lockout email');
  }
}

async function isAccountLocked(email, ip) {
  try {
    const redis = await getRedisClient();
    if (redis) {
      const redisFailed = await redis.get(`brute:${email}:${ip}`);
      if (redisFailed !== null) {
        return parseInt(redisFailed, 10) >= MAX_ATTEMPTS;
      }
    }
  } catch (err) {
    logger.error({ err }, 'Redis brute force check error');
  }

  // Fallback to DB
  const windowStart = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000);

  const emailRes = await pool.query(
    `SELECT COUNT(*) AS failed FROM login_attempts
     WHERE email = $1 AND ip_address = $2 AND success = false AND attempted_at > $3`,
    [email, ip, windowStart]
  );

  const ipRes = await pool.query(
    `SELECT COUNT(*) AS failed FROM login_attempts
     WHERE ip_address = $1 AND success = false AND attempted_at > $2`,
    [ip, windowStart]
  );

  const emailLocked = parseInt(emailRes.rows[0].failed, 10) >= MAX_ATTEMPTS;
  const ipLocked = parseInt(ipRes.rows[0].failed, 10) >= MAX_ATTEMPTS * 3;

  return emailLocked || ipLocked;
}

async function assertNotLocked(email, ip) {
  const locked = await isAccountLocked(email, ip);
  if (locked) {
    await notifyLockoutOnce(email, ip);
    const err = new UnauthorizedError(
      'Account temporarily locked. Please try again later.'
    );
    err.statusCode = 429;
    throw err;
  }
}

async function checkAndRecordAttempt(email, ip) {
  let count = 0;
  try {
    count = await incrementAttempt(email, ip);
  } catch (err) {
    logger.error({ err }, 'Redis increment attempt error');
  }

  if (count > 0) {
    if (count >= MAX_ATTEMPTS) {
      await notifyLockoutOnce(email, ip);
      const err = new UnauthorizedError(
        'Account temporarily locked. Please try again later.'
      );
      err.statusCode = 429;
      throw err;
    }
    return count;
  }

  // Fallback to DB check if Redis is unavailable or returned 0
  const locked = await isAccountLocked(email, ip);
  if (locked) {
    await notifyLockoutOnce(email, ip);
    const err = new UnauthorizedError(
      'Account temporarily locked. Please try again later.'
    );
    err.statusCode = 429;
    throw err;
  }

  return 0;
}

async function recordLoginAttempt(email, ip, success) {
  await pool.query(
    'INSERT INTO login_attempts (email, ip_address, success) VALUES ($1,$2,$3)',
    [email, ip, success]
  );
}

/**
 * Clears all failed login attempts for an email address.
 * Must be called on every successful login so that prior attacker-driven
 * failed attempts cannot cause a lockout for the legitimate user.
 */
async function clearFailedAttempts(email, ip) {
  await pool.query(
    `DELETE FROM login_attempts WHERE email = $1 AND ip_address = $2 AND success = false`,
    [email, ip]
  );

  try {
    const redis = await getRedisClient();
    if (redis) {
      await redis.del(`brute:${email}:${ip}`);
    }
  } catch (err) {
    logger.error({ err }, 'Redis clear failed attempts error');
  }
}

async function bruteForceCheck(request, reply) {
  const { email } = request.body || {};
  if (!email) return;

  try {
    await assertNotLocked(email, request.ip);
  } catch (err) {
    if (err instanceof UnauthorizedError && err.message.includes('locked')) {
      return reply.status(429).send({
        error: err.message,
      });
    }
    throw err;
  }
}

module.exports = {
  isAccountLocked,
  recordLoginAttempt,
  clearFailedAttempts,
  bruteForceCheck,
  incrementAttempt,
  assertNotLocked,
  checkAndRecordAttempt,
  setMaxAttempts,
  getMaxAttempts,
  get MAX_ATTEMPTS() {
    return MAX_ATTEMPTS;
  },
};
