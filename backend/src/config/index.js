require('dotenv').config();

function buildRedisUrl() {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!restUrl || !token) return null;
  // Extract host from url (remove https://)
  const host = restUrl.replace('https://', '').replace(/\/$/, '');
  return `rediss://default:${token}@${host}:6379`;
}

function resolveRefreshSecret() {
  const independent = process.env.JWT_REFRESH_SECRET;
  if (independent && independent.trim() !== '') return independent;
  // No independent secret configured. In production this is rejected by
  // validateEnv before we get here; outside production fall back to a derived
  // value so dev/CI keep functioning, with a warning.
  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      '⚠️ JWT_REFRESH_SECRET is not set; using a derived fallback. Set an independent JWT_REFRESH_SECRET (required in production).'
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
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    accessSecret: process.env.JWT_SECRET,
    // Independent refresh secret. Falls back to a derived value only outside
    // production so local/CI keep working; production must set JWT_REFRESH_SECRET
    // (enforced by validateEnv).
    refreshSecret: resolveRefreshSecret(),
    accessExpiry: '15m',
    refreshExpiry: process.env.JWT_EXPIRES_IN || '7d',
  },
  apiKey: process.env.API_KEY,
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5242880,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  redisUrl: buildRedisUrl(),
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
  },
  uptoskills: {
    baseUrl: process.env.UPTOSKILLS_BASE_URL || '',
    apiKey: process.env.UPTOSKILLS_API_KEY || '',
  },
  rateLimit: {
    globalMax: process.env.NODE_ENV === 'test' ? 1000 : 100,
    authMax: process.env.NODE_ENV === 'test' ? 100 : 50,
    timeWindow: '1 minute',
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
