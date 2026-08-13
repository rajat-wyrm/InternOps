const redis = require('redis');
const config = require('./index');
const logger = require('../logger');

let client = null;
let clientPromise = null;
let redisConnected = false;

/**
 * Safely extract Redis error information.
 */
function getSafeRedisError(err) {
  return {
    name: err?.name,
    code: err?.code,
    message: err?.message,
  };
}

/**
 * Build Redis client options.
 *
 * Returns null when Redis is not configured.
 */
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

      connectTimeout: 10000,

      // Do not continuously retry when Redis is unavailable.
      reconnectStrategy: false,
    },
  };
}

/**
 * Get Redis client.
 *
 * Redis is optional.
 *
 * If Redis is unavailable:
 * - application continues
 * - client remains null
 * - redisConnected remains false
 */
async function getRedisClient() {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  // Return existing connected client.
  if (client) {
    return client;
  }

  // Return existing connection attempt.
  if (clientPromise) {
    return clientPromise;
  }

  const redisOptions = buildRedisClientOptions();

  // Redis is not configured.
  if (!redisOptions) {
    return null;
  }

  clientPromise = (async () => {
    try {
      const redisClient = redis.createClient(redisOptions);

      redisClient.on('error', (err) => {
        redisConnected = false;

        logger.warn(
          {
            err: getSafeRedisError(err),
            name: 'redis_error',
          },
          'Redis connection error'
        );
      });

      redisClient.on('connect', () => {
        redisConnected = true;

        logger.info('Redis connected successfully');
      });

      redisClient.on('ready', () => {
        redisConnected = true;

        logger.info('Redis client ready');
      });

      redisClient.on('disconnect', () => {
        redisConnected = false;

        logger.warn(
          'Redis disconnected. Redis-dependent features are running in degraded mode.'
        );
      });

      await redisClient.connect();

      client = redisClient;
      redisConnected = true;

      logger.info('Redis available. Redis-dependent features are enabled.');

      return client;
    } catch (err) {
      client = null;
      redisConnected = false;

      logger.warn(
        {
          err: getSafeRedisError(err),
          name: 'redis_unavailable',
        },
        'Redis unavailable. Continuing in degraded mode.'
      );

      return null;
    }
  })();

  return clientPromise;
}

/**
 * Initialize Redis during application startup.
 *
 * This should be called once when the backend starts.
 */
async function initializeRedis() {
  if (process.env.NODE_ENV === 'test') {
    return {
      available: false,
      status: 'disabled',
    };
  }

  const redisConfig = config.redis;

  // Redis is disabled/not configured.
  if (!redisConfig?.enabled) {
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

  // Redis failed to connect.
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

/**
 * Get current Redis status.
 *
 * Returns:
 * - disabled
 * - connected
 * - disconnected
 */
function getRedisStatus() {
  if (process.env.NODE_ENV === 'test' || !config.redis?.enabled) {
    return 'disabled';
  }

  return redisConnected ? 'connected' : 'disconnected';
}

/**
 * Redis availability flag.
 *
 * This is the runtime equivalent of:
 *
 * redis.available
 */
function isRedisAvailable() {
  return redisConnected && client !== null;
}

/**
 * Get a simple Redis status object.
 */
function getRedisAvailability() {
  return {
    available: isRedisAvailable(),
    status: getRedisStatus(),
  };
}

/**
 * Blacklist an access token.
 *
 * If Redis is unavailable, the operation is skipped.
 */
async function blacklistAccessToken(jti, ttl) {
  if (!jti || !ttl) {
    return;
  }

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
    await redisClient.set(`blacklist:${jti}`, '1', {
      EX: ttl,
    });
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

/**
 * Check whether an access token is blacklisted.
 *
 * If Redis is unavailable, returns false so the application
 * can continue running.
 */
async function isAccessTokenBlacklisted(jti) {
  if (!jti) {
    return false;
  }

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

/**
 * Close Redis connection.
 *
 * Useful for graceful application shutdown and tests.
 */
async function closeRedis() {
  if (!client) {
    return;
  }

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
