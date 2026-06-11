const redis = require('redis');
const config = require('./index');

let client = null;
let redisConnected = false;

function getLogger() {
  try {
    const app = require('../app');
    if (app && app.log) return app.log;
  } catch (e) {}
  return {
    warn: (...args) => console.warn(...args),
    info: (...args) => console.info(...args),
    error: (...args) => console.error(...args)
  };
}

async function getRedisClient() {
  if (process.env.NODE_ENV === 'test') return null;
  if (!config.redisUrl) return null;   // No URL -> no Redis
  if (client) return client;

  try {
    client = redis.createClient({
      url: config.redisUrl,
      socket: { connectTimeout: 1000, reconnectStrategy: false }
    });

    client.on('error', (err) => {
      const log = getLogger();
      log.warn({ err, name: 'redis_error' }, 'Redis connection error');
    });

    client.on('disconnect', () => {
      redisConnected = false;
      const log = getLogger();
      log.warn('Redis disconnected');
    });

    client.on('connect', () => {
      redisConnected = true;
      const log = getLogger();
      log.info('Redis connected');
    });

    await client.connect();
    return client;
  } catch (err) {
    const log = getLogger();
    log.warn('Redis unavailable – continuing without it');
    client = null;
    return null;
  }
}

function getRedisStatus() {
  if (!config.redisUrl) return 'disabled';
  return redisConnected ? 'connected' : 'disconnected';
}

module.exports = { getRedisClient, getRedisStatus };



