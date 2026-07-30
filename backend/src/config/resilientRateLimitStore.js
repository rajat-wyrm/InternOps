const { getRedisClient, warnRedisFallback } = require('./redis');

const RATE_LIMIT_LUA = `
  local current = redis.call('INCR', KEYS[1])
  local timeWindow = tonumber(ARGV[1])
  local max = tonumber(ARGV[2])
  local continueExceeding = ARGV[3] == 'true'
  local exponentialBackoff = ARGV[4] == 'true'
  if current == 1 or (continueExceeding and current > max) then
    redis.call('PEXPIRE', KEYS[1], timeWindow)
  elseif exponentialBackoff and current > max then
    local ttl = math.min(timeWindow * (2 ^ (current - max - 1)), (2^53) - 1)
    redis.call('PEXPIRE', KEYS[1], ttl)
    timeWindow = ttl
  else
    timeWindow = redis.call('PTTL', KEYS[1])
  end
  return {current, timeWindow}
`;

class ResilientRateLimitStore {
  constructor(
    options,
    namespace = 'fastify-rate-limit-',
    feature = 'global rate limiting'
  ) {
    this.options = options;
    this.namespace = namespace;
    this.feature = feature;
    this.entries = new Map();
  }

  incr(key, callback, timeWindow, max) {
    this._increment(key, timeWindow, max).then(
      (result) => callback(null, result),
      (error) => callback(error)
    );
  }

  async _increment(key, timeWindow, max) {
    const redis = await getRedisClient(this.feature);

    const now = Date.now();

    // Remove expired entries
    for (const [storedKey, storedEntry] of this.entries) {
      if (storedEntry.startedAt + storedEntry.ttl <= now) {
        this.entries.delete(storedKey);
      }
    }
    if (redis) {
      try {
        const result = await redis.eval(RATE_LIMIT_LUA, {
          keys: [`${this.namespace}${key}`],
          arguments: [
            String(timeWindow),
            String(max),
            String(this.options.continueExceeding),
            String(this.options.exponentialBackoff),
          ],
        });
        return { current: Number(result[0]), ttl: Number(result[1]) };
      } catch (error) {
        warnRedisFallback(this.feature, error);
      }
    }

    const existing = this.entries.get(key);
    let entry = existing;
    if (!entry || entry.startedAt + timeWindow <= now) {
      entry = { current: 1, startedAt: now, ttl: timeWindow };
    } else {
      entry.current += 1;
      if (this.options.continueExceeding && entry.current > max)
        entry.startedAt = now;
      entry.ttl = timeWindow - (now - entry.startedAt);
    }
    this.entries.set(key, entry);
    return { current: entry.current, ttl: entry.ttl };
  }

  read(key, callback, timeWindow) {
    const entry = this.entries.get(key);
    const ttl =
      entry && entry.startedAt + timeWindow > Date.now()
        ? timeWindow - (Date.now() - entry.startedAt)
        : 0;
    callback(null, { current: ttl ? entry.current : 0, ttl });
  }

  child(routeOptions) {
    const { method, url } = routeOptions.routeInfo;
    return new ResilientRateLimitStore(
      routeOptions,
      `${this.namespace}${method}${url}-`,
      `rate limiting for ${method} ${url}`
    );
  }
}

module.exports = ResilientRateLimitStore;
