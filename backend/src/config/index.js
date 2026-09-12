require('dotenv').config();
const pino = require('pino');
const { z } = require('zod');
const { resolveDatabaseUrl } = require('./testDatabase');

const log = pino(
  process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty' } }
    : {}
);

function buildRedisConfig() {
  const redisUrl = process.env.REDIS_URL?.trim();

  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);

      if (!['redis:', 'rediss:'].includes(parsed.protocol)) {
        throw new Error('REDIS_URL must use redis:// or rediss://');
      }

      const database = Number.parseInt(parsed.pathname.replace(/^\//, ''), 10);

      return {
        enabled: true,
        available: false,
        source: 'REDIS_URL',
        host: parsed.hostname,
        port: Number.parseInt(parsed.port, 10) || 6379,
        username: parsed.username
          ? decodeURIComponent(parsed.username)
          : 'default',
        password: parsed.password
          ? decodeURIComponent(parsed.password)
          : undefined,
        database: Number.isInteger(database) ? database : 0,
        tls: parsed.protocol === 'rediss:',
      };
    } catch (err) {
      log.warn(
        { err: err?.message },
        'Invalid REDIS_URL; Redis-dependent features will use fallbacks'
      );
    }
  }

  const explicitHost = process.env.REDIS_HOST;
  const explicitPort = parseInt(process.env.REDIS_PORT, 10) || 6379;
  const explicitUsername = process.env.REDIS_USERNAME || 'default';
  const explicitPassword = process.env.REDIS_PASSWORD;

  if (explicitHost) {
    const isLocalHost =
      explicitHost === 'localhost' ||
      explicitHost === '127.0.0.1' ||
      explicitHost === 'redis';

    const useTls =
      process.env.REDIS_TLS !== undefined
        ? process.env.REDIS_TLS === 'true'
        : !isLocalHost;

    return {
      enabled: true,
      available: false,
      source: 'REDIS_HOST',
      host: explicitHost,
      port: explicitPort,
      username: explicitUsername,
      password: explicitPassword || undefined,
      database: Number.parseInt(process.env.REDIS_DB, 10) || 0,
      tls: useTls,
    };
  }

  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!restUrl || !token || restUrl === 'your-redis-url') {
    return {
      enabled: false,
      available: false,
      source: null,
      host: null,
      port: 6379,
      username: 'default',
      password: null,
      database: 0,
      tls: false,
    };
  }

  let host;

  try {
    host = new URL(restUrl).hostname;
  } catch {
    host = restUrl
      .replace(/^https?:\/\//, '')
      .replace(/^rediss?:\/\//, '')
      .replace(/\/$/, '')
      .split('/')[0]
      .split('@')
      .pop()
      .split(':')[0];
  }

  if (!host) {
    return {
      enabled: false,
      available: false,
      source: null,
      host: null,
      port: 6379,
      username: 'default',
      password: null,
      database: 0,
      tls: false,
    };
  }

  return {
    enabled: true,
    available: false,
    source: 'UPSTASH_REDIS_REST_URL',
    host,
    port: 6379,
    username: 'default',
    password: token,
    database: 0,
    tls: true,
  };
}

function parseDurationToSeconds(value, fallbackSeconds) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  const match = String(value || '')
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|y)?$/i);

  if (!match) return fallbackSeconds;

  const amount = Number(match[1]);
  const unit = (match[2] || 'ms').toLowerCase();

  const multipliers = {
    ms: 1 / 1000,
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
    w: 7 * 24 * 60 * 60,
    y: 365 * 24 * 60 * 60,
  };

  const seconds = amount * multipliers[unit];

  return Number.isFinite(seconds) && seconds > 0
    ? Math.floor(seconds)
    : fallbackSeconds;
}

function buildCookieConfig() {
  const production = process.env.NODE_ENV === 'production';
  const sameSite = (
    process.env.COOKIE_SAME_SITE || (production ? 'none' : 'lax')
  ).toLowerCase();
  const secure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : production;
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;

  const refreshExpiry =
    process.env.JWT_REFRESH_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '7d';

  const refreshMaxAge = parseDurationToSeconds(refreshExpiry, 7 * 24 * 60 * 60);

  return {
    secure,
    sameSite,
    domain,
    maxAge: refreshMaxAge,
  };
}

function resolveRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret || secret.trim() === '') {
    console.warn(
      '[Config] JWT_REFRESH_SECRET is not configured. Using derived secret from JWT_SECRET.'
    );

    return `${process.env.JWT_SECRET}_refresh`;
  }

  return secret;
}
const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
});
const env = envSchema.parse(process.env);
module.exports = {
  port: env.PORT,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV,
  databaseUrl: resolveDatabaseUrl(process.env),
  dbPoolMax: parseInt(process.env.DB_POOL_MAX, 10) || 20,
  jwt: {
    secret: process.env.JWT_SECRET,
    accessSecret: process.env.JWT_SECRET,
    refreshSecret: resolveRefreshSecret(),
    accessExpiry: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiry:
      process.env.JWT_REFRESH_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '7d',
  },
  apiKey: process.env.API_KEY,
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5242880,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  appUrl:
    process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:5173',
  cookie: buildCookieConfig(),
  redis: buildRedisConfig(),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  fast2sms: {
    apiKey: process.env.FAST2SMS_API_KEY,
  },
  ai: {
    fastapiUrl: process.env.FASTAPI_URL,
    timeout: parseInt(process.env.AI_TIMEOUT, 10) || 25000,
    groqKey: process.env.GROQ_API_KEY,
    openaiKey: process.env.OPENAI_API_KEY,
    geminiKey: process.env.GEMINI_API_KEY,
    deepseekKey: process.env.DEEPSEEK_API_KEY,
    deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL,
    huggingfaceToken: process.env.HUGGINGFACE_TOKEN,
    dailyLimit: parseInt(process.env.AI_CHAT_DAILY_LIMIT, 10) || 100,
  },
  uptoskills: {
    baseUrl: process.env.UPTOSKILLS_BASE_URL || '',
    apiKey: process.env.UPTOSKILLS_API_KEY || '',
  },
  rateLimit: {
    globalMax:
      parseInt(process.env.RATE_LIMIT_GLOBAL_MAX, 10) ||
      (process.env.NODE_ENV === 'test' ? 10000 : 100),
    authMax:
      parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) ||
      (process.env.NODE_ENV === 'test' ? 10000 : 50),
    refreshMax:
      parseInt(process.env.RATE_LIMIT_REFRESH_MAX, 10) ||
      (process.env.NODE_ENV === 'test' ? 10000 : 60),
    csrfMax:
      parseInt(process.env.RATE_LIMIT_CSRF_MAX, 10) ||
      (process.env.NODE_ENV === 'test' ? 10000 : 300),
    timeWindow: process.env.RATE_LIMIT_TIME_WINDOW || '1 minute',
    passwordResetCooldownMs:
      parseInt(process.env.PASSWORD_RESET_COOLDOWN_MS, 10) || 5 * 60 * 1000,
    passwordResetHourlyMax:
      parseInt(process.env.PASSWORD_RESET_HOURLY_MAX, 10) || 5,
  },
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    apiKey: process.env.EMAIL_API_KEY,
    from: process.env.EMAIL_FROM || 'noreply@internops.com',
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    retryMax: parseInt(process.env.EMAIL_RETRY_MAX, 10) || 3,
    rateLimitPerRecipient: parseInt(process.env.EMAIL_RATE_LIMIT, 10) || 5,
    rateLimitWindowMs: parseInt(process.env.EMAIL_RATE_WINDOW, 10) || 60000,
    bounceCheckEnabled: process.env.EMAIL_BOUNCE_CHECK === 'true',
  },
  sentry: {
    dsn: process.env.SENTRY_DSN || null,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
  },
  websocket: {
    maxUnauthenticatedConnections:
      parseInt(process.env.MAX_UNAUTHENTICATED_WEBSOCKET_CONNECTIONS, 10) || 20,
    authTimeoutMs: parseInt(process.env.WEBSOCKET_AUTH_TIMEOUT_MS, 10) || 5000,
  },
};
