const redis = require('redis');
const config = require('./index');
const logger = require('../logger');

let client = null;
let clientPromise = null;
let redisConnected = false;
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

  if (!redisConfig?.enabled || !redisConfig.host) {
    return null;
  }

  const options = {
    username: redisConfig.username || 'default',
    password: redisConfig.password || undefined,
    socket: {
      host: redisConfig.host,
      port: redisConfig.port || 6379,
      tls: redisConfig.tls !== false && process.env.REDIS_TLS === 'true',
      connectTimeout: 1000,
      reconnectStrategy: false,
    },
  };
  if (redisConfig.password) {
    options.password = redisConfig.password;
  }

  return options;
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
    let c = null;

    try {
      c = redis.createClient(redisOptions);

      c.on('error', (err) => {
        logger.warn(
          {
            err: getSafeRedisError(err),
            name: 'redis_error',
          },
          'Redis connection error'
        );
      });

      c.on('disconnect', () => {
        redisConnected = false;
        client = null;
        clientPromise = null;

        logger.warn('Redis disconnected');
        scheduleReconnect();
      });

      c.on('connect', () => {
        redisConnected = true;
        logger.info('Redis connected');
      });

      await c.connect();

      client = c;
      redisConnected = true;
      reconnectDelay = 1000;

      return client;
    } catch (err) {
      logger.warn('Redis unavailable - continuing in fallback mode');

      redisConnected = false;

      if (c) {
        try {
          await c.disconnect();
        } catch (discErr) {
          // Ignore disconnect errors
        }
      }

      client = null;
      clientPromise = null;
      redisConnected = false;

      scheduleReconnect();

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
    logger.warn(
      { jti },
      'Redis unavailable — skipping token revocation check (fail open)'
    );

    // Fail open: allow the request when Redis is unavailable.
    // The token is still cryptographically verified by verifyAccessToken().
    // Failing closed here would block all authenticated users whenever Redis
    // is down, which is a much worse outcome than the narrow risk of a
    // revoked token being replayed during a Redis outage.
    return false;
  }

  return (await client.exists(`blacklist:${jti}`)) === 1;
}

module.exports = {
  getRedisClient,
  getRedisStatus,
  blacklistAccessToken,
  isAccessTokenBlacklisted,
};
