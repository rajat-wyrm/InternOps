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

  if (client) return client;
  if (clientPromise) return clientPromise;

  const redisOptions = buildRedisClientOptions();

  if (!redisOptions) return null;

  clientPromise = (async () => {
    try {
      const c = redis.createClient(redisOptions);

      c.on('error', (err) => {
        redisConnected = false;

        logger.warn(
          { err: getSafeRedisError(err), name: 'redis_error' },
          'Redis connection error'
        );
      });

      c.on('disconnect', () => {
        redisConnected = false;

        logger.warn(
          'Redis disconnected. Redis-dependent features are running in degraded mode.'
        );
      });

      c.on('connect', () => {
        redisConnected = true;
        logger.info('Redis connected');
      });

      await c.connect();

      client = c;
      redisConnected = true;

      return client;
    } catch (err) {
      client = null;
      redisConnected = false;

      logger.warn(
        { err: getSafeRedisError(err), name: 'redis_unavailable' },
        'Redis unavailable. Continuing in degraded mode.'
      );

      return null;
    }
  })();

  return clientPromise;
}

async function initializeRedis() {
  if (process.env.NODE_ENV === 'test') {
    return {
      available: false,
      status: 'disabled',
    };
  }

  if (!config.redis?.enabled) {
    redisConnected = false;

    logger.warn('Redis is not configured. Running in degraded mode.');

    logger.warn(
      'Degraded features: rate limiting may use memory storage, session cache may be disabled, and WebSocket coordination may be unavailable.'
    );

    return {
      available: false,
      status: 'disabled',
    };
  }

  const redisClient = await getRedisClient();

  if (!redisClient) {
    redisConnected = false;

    logger.warn('Redis is unavailable. Running in degraded mode.');

    logger.warn(
      'Degraded features: rate limiting may use memory storage, session cache may be disabled, and WebSocket coordination may be unavailable.'
    );

    return {
      available: false,
      status: 'disconnected',
    };
  }

  redisConnected = true;

  logger.info('Redis-dependent features are fully enabled.');

  return {
    available: true,
    status: 'connected',
  };
}

function getRedisStatus() {
  if (process.env.NODE_ENV === 'test' || !config.redis?.enabled) {
    return 'disabled';
  }

  return redisConnected ? 'connected' : 'disconnected';
}

function isRedisAvailable() {
  return redisConnected && client !== null;
}

function getRedisAvailability() {
  return {
    available: isRedisAvailable(),
    status: getRedisStatus(),
  };
}

async function blacklistAccessToken(jti, ttl) {
  if (!jti || !ttl) return;

  const redisClient = await getRedisClient();

  if (!redisClient) {
    logger.warn(
      {
        name: 'redis_feature_degraded',
        feature: 'access_token_blacklist',
      },
      'Redis unavailable. Access-token blacklist operation skipped.'
    );

    return;
  }

  try {
    await redisClient.set(`blacklist:${jti}`, '1', { EX: ttl });
  } catch (err) {
    redisConnected = false;

    logger.warn(
      {
        err: getSafeRedisError(err),
        name: 'redis_operation_failed',
        feature: 'access_token_blacklist',
      },
      'Redis blacklist operation failed. Continuing without Redis.'
    );
  }
}

async function isAccessTokenBlacklisted(jti) {
  if (!jti) return false;

  const redisClient = await getRedisClient();

  if (!redisClient) {
    logger.warn(
      {
        name: 'redis_feature_degraded',
        feature: 'access_token_blacklist',
      },
      'Redis unavailable. Access-token blacklist check skipped.'
    );

    return false;
  }

  try {
    const exists = await redisClient.exists(`blacklist:${jti}`);
    return exists === 1;
  } catch (err) {
    redisConnected = false;

    logger.warn(
      {
        err: getSafeRedisError(err),
        name: 'redis_operation_failed',
        feature: 'access_token_blacklist',
      },
      'Redis blacklist check failed. Continuing without Redis.'
    );

    return false;
  }
}

async function closeRedis() {
  if (!client) return;

  try {
    await client.quit();
  } catch (err) {
    logger.warn(
      {
        err: getSafeRedisError(err),
        name: 'redis_close_error',
      },
      'Failed to close Redis connection cleanly.'
    );
  } finally {
    client = null;
    clientPromise = null;
    redisConnected = false;
  }
}

module.exports = {
  getRedisClient,
  initializeRedis,
  getRedisStatus,
  isRedisAvailable,
  getRedisAvailability,
  blacklistAccessToken,
  isAccessTokenBlacklisted,
  closeRedis,
};
