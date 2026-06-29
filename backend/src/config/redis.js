const redis = require('redis');
const config = require('./index');

let client = null;
let clientPromise = null;
let redisConnected = false;

function getLogger() {
  try {
    const app = require('../app');
    if (app && app.log) return app.log;
  } catch (e) {}
  return {
    warn: (...args) => console.warn(...args),
    info: (...args) => console.info(...args),
    error: (...args) => console.error(...args),
  };
}

async function getRedisClient() {
  if (process.env.NODE_ENV === 'test') return null;
  if (!config.redisUrl) return null; // No URL -> no Redis
  if (client) return client;
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    try {
      const c = redis.createClient({
        url: config.redisUrl,
        socket: { connectTimeout: 1000, reconnectStrategy: false },
      });

      c.on('error', (err) => {
        const log = getLogger();
        log.warn({ err, name: 'redis_error' }, 'Redis connection error');
      });

      c.on('disconnect', () => {
        redisConnected = false;
        const log = getLogger();
        log.warn('Redis disconnected');
      });

      c.on('connect', () => {
        redisConnected = true;
        const log = getLogger();
        log.info('Redis connected');
      });

      await c.connect();
      client = c;
      return client;
    } catch (err) {
      const log = getLogger();
      log.warn('Redis unavailable – continuing without it');
      client = null;
      // Do NOT reset clientPromise here — keep the settled-null promise so that
      // every subsequent call short-circuits at `if (clientPromise) return clientPromise`
      // and returns null immediately instead of retrying the failing DNS lookup.
      return null;
    }
  })();

  return clientPromise;
}

function getRedisStatus() {
  if (process.env.NODE_ENV === 'test' || !config.redisUrl) return 'disabled';
  return redisConnected ? 'connected' : 'disconnected';
}

module.exports = { getRedisClient, getRedisStatus };
