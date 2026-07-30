const redis = require('redis');
const config = require('./index');
const logger = require('../logger');

let client = null;
let clientPromise = null;
let redisConnected = false;
let listenersAttached = false;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;
const warnedFallbackFeatures = new Set();

const DEGRADED_FEATURES = [
  'global and route rate limits are per-process and reset on restart',
  'brute-force counters and lockout-email deduplication use database/local fallbacks',
  'email recipient rate limits are per-process and reset on restart',
  'AI responses use the local cache only',
  'session reads fall back to PostgreSQL; Redis cache cleanup is skipped',
  'access-token blacklist checks are unavailable',
];

function getSafeRedisError(err) {
  return {
    name: err?.name,
    code: err?.code,
    message: err?.message,
  };
}

function warnRedisFallback(feature, err) {
  if (process.env.NODE_ENV === 'test' || warnedFallbackFeatures.has(feature)) {
    return;
  }

  warnedFallbackFeatures.add(feature);
  logger.warn(
    {
      feature,
      redisAvailable: false,
      ...(err && { err: getSafeRedisError(err) }),
    },
    `Redis unavailable; ${feature} is using its degraded fallback`
  );
}

function setRedisAvailability(available) {
  config.redis.available = available;
}

function buildRedisClientOptions() {
  const redisConfig = config.redis;

  if (!redisConfig?.enabled || !redisConfig.host) {
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

let reconnectTimer = null;

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    clientPromise = null;
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
  }, reconnectDelay);

  reconnectTimer.unref();
}

async function getRedisClient(feature) {
  if (process.env.NODE_ENV === 'test') return null;

  const redisOptions = buildRedisClientOptions();
  if (!redisOptions) {
    setRedisAvailability(false);
    if (feature) warnRedisFallback(feature);
    return null;
  }

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
          setRedisAvailability(false);
          client = null;
          clientPromise = null;

          logger.warn('Redis disconnected');
        });

        c.on('connect', () => {
          redisConnected = true;
          setRedisAvailability(true);
          logger.info('Redis connected');
        });

        listenersAttached = true;
      }
      await c.connect();

      client = c;
      redisConnected = true;
      setRedisAvailability(true);
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
      setRedisAvailability(false);
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

function getRedisDegradedFeatures() {
  return [...DEGRADED_FEATURES];
}

async function blacklistAccessToken(jti, ttl) {
  const client = await getRedisClient('access-token blacklist');
  if (!client) return;

  await client.set(`blacklist:${jti}`, '1', { EX: ttl });
}

async function isAccessTokenBlacklisted(jti) {
  const client = await getRedisClient('access-token blacklist');
  if (!client) return false;

  return (await client.exists(`blacklist:${jti}`)) === 1;
}

module.exports = {
  getRedisClient,
  getRedisStatus,
  getRedisDegradedFeatures,
  warnRedisFallback,
  blacklistAccessToken,
  isAccessTokenBlacklisted,
};
