const redis = require('redis');
const config = require('./index');
const logger = require('../logger');

let client = null;
let clientPromise = null;
let redisConnected = false;

function getSafeRedisError(err) {
  return {
    name: err?.name,
    code: err?.code,
    message: err?.message,
  };
}

function buildRedisClientOptions() {
  const redisConfig = config.redis;

  if (!redisConfig?.enabled || !redisConfig.host || !redisConfig.password) {
    return null;
  }

  return {
    username: redisConfig.username || 'default',
    password: redisConfig.password,
    socket: {
      host: redisConfig.host,
      port: redisConfig.port || 6379,
      tls: redisConfig.tls !== false,
      connectTimeout: 1000,
      reconnectStrategy: false,
    },
  };
}

async function getRedisClient() {
  if (process.env.NODE_ENV === 'test') return null;

  const redisOptions = buildRedisClientOptions();
  if (!redisOptions) return null;

  if (client) return client;
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    try {
      const c = redis.createClient(redisOptions);

      c.on('error', (err) => {
        logger.warn(
          { err: getSafeRedisError(err), name: 'redis_error' },
          'Redis connection error'
        );
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
      logger.warn(
        { err: getSafeRedisError(err), name: 'redis_unavailable' },
        'Redis unavailable - continuing without it'
      );

      client = null;

      // Do NOT reset clientPromise here. Keep the settled-null promise so each
      // subsequent call returns null immediately instead of retrying repeatedly.
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
