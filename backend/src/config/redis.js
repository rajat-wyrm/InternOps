const redis = require('redis');
const config = require('./index');
const logger = require('../logger');

let client = null;
let clientPromise = null;
let redisConnected = false;
let reconnectDelay = 1000;
let retryAfter = 0;
let reconnectTimer = null;
const MAX_RECONNECT_DELAY = 30000;
const degradedWarnings = new Set();

const REDIS_DEGRADED_FEATURES = Object.freeze([
  {
    feature: 'rate limiting',
    fallback:
      'PostgreSQL or in-memory counters; memory counters reset on restart',
  },
  {
    feature: 'session cache',
    fallback: 'PostgreSQL session storage',
  },
  {
    feature: 'access-token revocation',
    fallback: 'JWT validation only until the access token expires',
  },
  {
    feature: 'WebSocket token coordination',
    fallback: 'JWT validation without shared revocation state',
  },
  {
    feature: 'bulk job queue',
    fallback: 'direct in-process execution',
  },
]);

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
    database: redisConfig.database || 0,
    socket: {
      host: redisConfig.host,
      port: redisConfig.port || 6379,
      tls: Boolean(redisConfig.tls),
      connectTimeout: 1000,
      reconnectStrategy: false,
    },
  };
  if (redisConfig.password) {
    options.password = redisConfig.password;
  }

  return options;
}

function setRedisAvailable(available) {
  redisConnected = available;
  if (config.redis) {
    config.redis.available = available;
  }

  if (available) {
    degradedWarnings.clear();
  }
}

function warnRedisDegraded(feature, fallback, err) {
  const warningKey = `${feature}:${fallback}`;
  if (degradedWarnings.has(warningKey)) return;
  degradedWarnings.add(warningKey);

  logger.warn(
    {
      feature,
      fallback,
      redisStatus: getRedisStatus(),
      ...(err ? { err: getSafeRedisError(err) } : {}),
    },
    `Redis unavailable; ${feature} is using its fallback`
  );
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  retryAfter = Date.now() + reconnectDelay;
  reconnectTimer = setTimeout(() => {
    clientPromise = null;
    retryAfter = 0;
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
  }, reconnectDelay).unref();
}

async function getRedisClient() {
  if (process.env.NODE_ENV === 'test') {
    setRedisAvailable(false);
    return null;
  }

  const redisOptions = buildRedisClientOptions();
  if (!redisOptions) {
    setRedisAvailable(false);
    return null;
  }

  if (client?.isReady) return client;
  if (client && !client.isReady) client = null;

  if (Date.now() < retryAfter) {
    return null;
  }
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    let c = null;

    try {
      c = redis.createClient(redisOptions);

      c.on('error', (err) => {
        if (!c.isReady) setRedisAvailable(false);
        logger.warn(
          {
            err: getSafeRedisError(err),
            name: 'redis_error',
          },
          'Redis connection error'
        );
      });

      c.on('end', () => {
        setRedisAvailable(false);
        client = null;
        clientPromise = null;

        logger.warn('Redis disconnected');
        scheduleReconnect();
      });

      c.on('ready', () => {
        setRedisAvailable(true);
        logger.info('Redis connected');
      });

      await c.connect();

      client = c;
      setRedisAvailable(true);
      reconnectDelay = 1000;
      retryAfter = 0;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      return client;
    } catch (err) {
      logger.warn(
        { err: getSafeRedisError(err) },
        'Redis unavailable - continuing in fallback mode'
      );

      setRedisAvailable(false);

      if (c) {
        try {
          await c.disconnect();
        } catch (discErr) {
          // Ignore disconnect errors
        }
      }

      client = null;
      clientPromise = null;

      scheduleReconnect();

      return null;
    }
  })();

  return clientPromise;
}

async function runRedisOperation(
  feature,
  fallback,
  operation,
  fallbackValue = null
) {
  const redisClient = await getRedisClient();

  if (!redisClient) {
    warnRedisDegraded(feature, fallback);
    return fallbackValue;
  }

  try {
    return await operation(redisClient);
  } catch (err) {
    setRedisAvailable(Boolean(redisClient.isReady));
    warnRedisDegraded(feature, fallback, err);
    return fallbackValue;
  }
}

function getRedisStatus() {
  if (process.env.NODE_ENV === 'test' || !config.redis?.enabled) {
    return 'disabled';
  }

  return redisConnected ? 'connected' : 'disconnected';
}

function getRedisDegradedFeatures() {
  return getRedisStatus() === 'connected' ? [] : REDIS_DEGRADED_FEATURES;
}

async function blacklistAccessToken(jti, ttl) {
  await runRedisOperation(
    'access-token revocation',
    'the access token remains valid until it expires',
    (redisClient) => redisClient.set(`blacklist:${jti}`, '1', { EX: ttl })
  );
  return undefined;
}

async function isAccessTokenBlacklisted(jti) {
  // Fail open: the token is still cryptographically verified by
  // verifyAccessToken(). Failing closed would block every authenticated user
  // during a Redis outage.
  return runRedisOperation(
    'access-token revocation check',
    'JWT validation only until the access token expires',
    async (redisClient) => (await redisClient.exists(`blacklist:${jti}`)) === 1,
    false
  );
}

module.exports = {
  getRedisClient,
  getRedisStatus,
  getRedisDegradedFeatures,
  runRedisOperation,
  warnRedisDegraded,
  blacklistAccessToken,
  isAccessTokenBlacklisted,
};
