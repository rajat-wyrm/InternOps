const redis = require('redis');
const config = require('./index');
const logger = require('../logger');

let client = null;
let clientPromise = null;
let redisConnected = false;
let listenersAttached = false;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;

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
function scheduleReconnect() {
  setTimeout(() => {
    clientPromise = null;
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
  }, reconnectDelay).unref();
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
      if (!listenersAttached) {
        c.on('error', (err) => {
          logger.warn(
            { err: getSafeRedisError(err), name: 'redis_error' },
            'Redis connection error'
          );
        });

        c.on('disconnect', () => {
          redisConnected = false;
          client = null;
          clientPromise = null;

          logger.warn('Redis disconnected');
        });

        c.on('connect', () => {
          redisConnected = true;
          logger.info('Redis connected');
        });

        listenersAttached = true;
      }
      await c.connect();

      client = c;
      redisConnected = true;
      reconnectDelay = 1000;

      return client;
    } catch (err) {
      logger.warn(
        { err: getSafeRedisError(err), name: 'redis_unavailable' },
        'Redis unavailable - continuing without it'
      );

      client = null;
      clientPromise = null;
      listenersAttached = false;
      redisConnected = false;
      scheduleReconnect();

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

  if (!client) {
    logger.error(
      { jti },

      'Redis unavailable — cannot verify token revocation status'
    );

    // Fail closed: treat token as revoked when revocation cannot be verified.

    return process.env.NODE_ENV !== 'test';
  }

  return (await client.exists(`blacklist:${jti}`)) === 1;
}

module.exports = {
  getRedisClient,
  getRedisStatus,
  blacklistAccessToken,
  isAccessTokenBlacklisted,
};
