const redis = require('redis');
const config = require('./index');
const logger = require('../logger');

let client = null;
let clientPromise = null;
let redisConnected = false;

async function getRedisClient() {
  if (process.env.NODE_ENV === 'test') return null;
  if (!config.redisUrl) return null;
  if (client) return client;
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    try {
      const c = redis.createClient(redisOptions);

      c.on('error', (err) => {
        logger.warn({ err, name: 'redis_error' }, 'Redis connection error');
      });

      c.on('disconnect', () => {
        redisConnected = false;
        logger.warn('Redis disconnected');
      });

      c.on('connect', () => {
        redisConnected = true;
        logger.info('Redis connected');
      });

      await c.connect();
      client = c;
      return client;
    } catch (err) {
      logger.warn('Redis unavailable – continuing without it');
      client = null;
      return null;
    }
  })();

  return clientPromise;
}

function getRedisStatus() {
  if (process.env.NODE_ENV === 'test' || !config.redis?.enabled) {
    return 'disabled';
  }

  return redisConnected ? 'connected' : 'disconnected';
}

async function blacklistAccessToken(jti, ttl) {
  const client = await getRedisClient();
  if (!client) return;
  await client.set(`blacklist:${jti}`, '1', { EX: ttl });
}

async function isAccessTokenBlacklisted(jti) {
  const client = await getRedisClient();
  if (!client) return false;
  return (await client.exists(`blacklist:${jti}`)) === 1;
}

module.exports = {
  getRedisClient,
  getRedisStatus,
  blacklistAccessToken,
  isAccessTokenBlacklisted,
};
