require('dotenv').config();
const pino = require('pino');

const log = pino(
  process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty' } }
    : {}
);

function buildRedisConfig() {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const explicitHost = process.env.REDIS_HOST;
  const explicitPort = parseInt(process.env.REDIS_PORT, 10) || 6379;
  const explicitUsername = process.env.REDIS_USERNAME || 'default';
  const explicitPassword = process.env.REDIS_PASSWORD;

  if (explicitHost && explicitPassword) {
    return {
      enabled: true,
      host: explicitHost,
      port: explicitPort,
      username: explicitUsername,
      password: explicitPassword,
      tls: process.env.REDIS_TLS !== 'false',
    };
  }

  if (!restUrl || !token) {
    return {
      enabled: false,
      host: null,
      port: 6379,
      username: 'default',
      password: null,
      tls: true,
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
      host: null,
      port: 6379,
      username: 'default',
      password: null,
      tls: true,
    };
  }

  return {
    enabled: true,
    host,
    port: 6379,
    username: 'default',
    password: token,
    tls: true,
  };
}

function resolveRefreshSecret() {
  const independent = process.env.JWT_REFRESH_SECRET;
  if (independent && independent.trim() !== '') return independent;

  if (process.env.NODE_ENV !== 'test') {
    log.warn(
      'JWT_REFRESH_SECRET is not set; using a derived fallback. Set an independent JWT_REFRESH_SECRET (required in production).'
    );
  }
  return process.env.JWT_SECRET
    ? `${process.env.JWT_SECRET}_refresh`
    : undefined;
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL,
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
    timeWindow: process.env.RATE_LIMIT_TIME_WINDOW || '1 minute',
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
};
