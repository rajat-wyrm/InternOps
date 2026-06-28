const pool = require('../config/db');
const { getRedisClient } = require('../config/redis');
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function isAccountLocked(email, ip) {
  const windowStart = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000);
  const emailRes = await pool.query(
    `SELECT COUNT(*) AS failed FROM login_attempts
     WHERE email = $1 AND success = false AND attempted_at > $2`,
    [email, windowStart]
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

  if (!success) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        const key = `brute:${email}:${ip}`;
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, 24 * 60 * 60);
        }
      }
    } catch (err) {
      console.error('Redis record failed login attempt error:', err);
    }
  }
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
};
