const { z } = require('zod');
const logger = require('../logger');

const REQUIRED_VARS = ['JWT_SECRET', 'DATABASE_URL', 'NODE_ENV'];
const OPTIONAL_VARS = ['PORT', 'CORS_ORIGIN', 'REDIS_URL'];

const envSchema = z.object({
  JWT_SECRET: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  JWT_REFRESH_SECRET: z.string().min(1).optional(),
});

function validateEnv() {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (process.env.JWT_SECRET === 'change_this_secret_in_production') {
    logger.error(
      '❌ CRITICAL ERROR: JWT_SECRET is set to the default insecure value.'
    );
    process.exit(1);
  }

  const missingRequired = [];
  const missingOptional = [];

  // In production the refresh secret must be an independent high-entropy value,
  // not derived from JWT_SECRET. Outside production a derived fallback is allowed.
  const requiredVars =
    process.env.NODE_ENV === 'production'
      ? [...REQUIRED_VARS, 'JWT_REFRESH_SECRET']
      : REQUIRED_VARS;

  for (const key of requiredVars) {
    if (!process.env[key] || !process.env[key].trim()) {
      missingRequired.push(key);
    }
  }

  for (const key of OPTIONAL_VARS) {
    if (!process.env[key] || !process.env[key].trim()) {
      missingOptional.push(key);
    }
  }

  if (missingOptional.length > 0) {
    logger.warn('⚠️ Missing optional environment variables:');
    for (const key of missingOptional) {
      logger.warn(`  • ${key}`);
    }
  }

  const schemaResult = envSchema.safeParse(process.env);
  const typeErrors = [];

  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      typeErrors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
  }

  if (missingRequired.length > 0 || typeErrors.length > 0) {
    if (missingRequired.length > 0) {
      logger.error('❌ Missing required environment variables:');
      for (const key of missingRequired) {
        logger.error(`  • ${key}`);
      }
    }

    if (typeErrors.length > 0) {
      logger.error('❌ Invalid environment variable types:');
      for (const err of typeErrors) {
        logger.error(`  • ${err}`);
      }
    }

    process.exit(1);
  }

  // Validate DATABASE_URL format
  const dbUrl = process.env.DATABASE_URL;
  let isDbUrlValid = false;
  try {
    const parsed = new URL(dbUrl);
    if (
      parsed.protocol === 'postgres:' ||
      parsed.protocol === 'postgresql:'
    ) {
      isDbUrlValid = true;
    }
  } catch (err) {
    // URL parsing failed
  }

  if (!isDbUrlValid) {
    logger.error('❌ Invalid environment variable format:');
    logger.error(
      'DATABASE_URL must be a valid PostgreSQL connection string starting with postgres:// or postgresql://'
    );
    process.exit(1);
  }
}

module.exports = validateEnv;
