const pool = require('../config/db');
const { getRedisClient } = require('../config/redis');
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const repo = require('../modules/auth/repository');
const emailService = require('../services/email');

async function incrementAttempt(email, ip) {
  const redis = await getRedisClient();
  if (!redis) return 0;

  const key = `brute:${email}:${ip}`;
  const count = await redis.incr(key);
  await redis.expire(key, LOCKOUT_MINUTES * 60);
  return count;
}

async function isAccountLocked(email, ip) {
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

  if (emailLocked || ipLocked) return true;

  try {
    const redis = await getRedisClient();
    if (redis) {
      const redisFailed = await redis.get(`brute:${email}:${ip}`);
      if (redisFailed && parseInt(redisFailed, 10) >= MAX_ATTEMPTS) {
        return true;
      }
    }
  } catch (err) {
    console.error('Redis brute force check error:', err);
  }

  return false;
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
    console.error('Redis clear failed attempts error:', err);
  }
}

async function bruteForceCheck(request, reply) {
  const { email } = request.body;
  if (!email) return;

  const ip = request.ip;
  const locked = await isAccountLocked(email, ip);
  if (locked) {
    const user = await repo.findByEmail(email);
    if (user) {
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
            // Set key with expiry equal to lockout duration (15 minutes)
            await redis.set(notifyKey, '1', { EX: LOCKOUT_MINUTES * 60 });
          }
        } else {
          // Fallback if Redis is down – send once but without deduplication
          await emailService.sendAccountLockoutNotification(email, {
            ipAddress: ip,
            timestamp: new Date().toISOString(),
            failedAttempts: MAX_ATTEMPTS,
          });
        }
      } catch (err) {
        console.error('Failed to send lockout email:', err);
      }
    }

    return reply.status(429).send({
      error:
        'Account temporarily locked due to too many failed attempts. Please try again later.',
    });
  }
}

module.exports = {
  isAccountLocked,
  recordLoginAttempt,
  clearFailedAttempts,
  bruteForceCheck,
  incrementAttempt,
};
