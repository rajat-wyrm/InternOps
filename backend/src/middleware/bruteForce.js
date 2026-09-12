const pool = require('../config/db');
const redisModule = require('../config/redis');
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

async function runRedisOp(op, fallbackValue = null) {
  if (typeof redisModule.runRedisOperation === 'function') {
    return redisModule.runRedisOperation(
      'login rate limiting',
      'using the PostgreSQL login-attempt history',
      op
    );
  }
  if (typeof redisModule.getRedisClient === 'function') {
    const client = await redisModule.getRedisClient();
    if (!client) return fallbackValue;
    return op(client);
  }
  return fallbackValue;
}

async function incrementAttempt(email, ip) {
  const key = `brute:${email}:${ip}`;
  return runRedisOp(async (redis) => {
    const count = await redis.incr(key);
    await redis.expire(key, LOCKOUT_MINUTES * 60);
    return count;
  }, 0);
}

async function notifyLockoutOnce(email, ip) {
  let user;
  try {
    user = await repo.findByEmail(email);
  } catch (err) {
    logger.error({ err }, 'Error checking user for lockout notification');
  }
  if (!user) return;

  const adminMsg = `Account Locked\nUser: ${email}\nIssue: Too many failed login attempts (${MAX_ATTEMPTS})\nTime: ${new Date().toLocaleString()}`;

  try {
    const notifyKey = `lockout-email:${email}`;
    let alreadySent = null;

    await runRedisOp(async (redis) => {
      alreadySent = await redis.get(notifyKey);
      if (!alreadySent) {
        await redis.set(notifyKey, '1', { EX: LOCKOUT_MINUTES * 60 });
      }
    });

    if (!alreadySent) {
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
    const redisFailed = await runRedisOp(async (redis) => {
      return redis.get(`brute:${email}:${ip}`);
    }, null);

    if (redisFailed !== null && redisFailed !== undefined) {
      return parseInt(redisFailed, 10) >= MAX_ATTEMPTS;
    }
  } catch (err) {
    logger.error({ err }, 'Redis brute force check error');
  }

  // Fallback to DB query ONLY if Redis returned null or errored
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
  const count = (await incrementAttempt(email, ip)) || 0;

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

  // Fallback check if Redis was unavailable or increment returned 0
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

async function clearFailedAttempts(email, ip) {
  await pool.query(
    `DELETE FROM login_attempts WHERE email = $1 AND ip_address = $2 AND success = false`,
    [email, ip]
  );

  try {
    await runRedisOp(async (redis) => {
      await redis.del(`brute:${email}:${ip}`);
    });
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
    if (
      err instanceof UnauthorizedError &&
      (err.statusCode === 429 || err.message.includes('locked'))
    ) {
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
