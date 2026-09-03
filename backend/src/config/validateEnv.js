const { z } = require('zod');

const REQUIRED_VARS = ['JWT_SECRET', 'DATABASE_URL', 'NODE_ENV'];

const OPTIONAL_VARS = ['REDIS_URL', 'GOOGLE_CLIENT_ID', 'EMAIL_API_KEY'];

const envSchema = z.object({
  PORT: z.string().regex(/^\d+$/, 'PORT must be a valid integer').optional(),
  SMTP_PORT: z
    .string()
    .regex(/^\d+$/, 'SMTP_PORT must be a valid integer')
    .optional(),
  MAX_FILE_SIZE: z
    .string()
    .regex(/^\d+$/, 'MAX_FILE_SIZE must be a valid integer')
    .optional(),
  AI_TIMEOUT: z
    .string()
    .regex(/^\d+$/, 'AI_TIMEOUT must be a valid integer')
    .optional(),
  PASSWORD_RESET_COOLDOWN_MS: z
    .string()
    .regex(/^\d+$/, 'PASSWORD_RESET_COOLDOWN_MS must be a valid integer')
    .optional(),
  PASSWORD_RESET_HOURLY_MAX: z
    .string()
    .regex(/^\d+$/, 'PASSWORD_RESET_HOURLY_MAX must be a valid integer')
    .optional(),
});

function validateEnv() {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  if (process.env.JWT_SECRET === 'change_this_secret_in_production') {
    console.error(
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
    const val = process.env[key];
    if (val === undefined || val === null || String(val).trim() === '') {
      missingRequired.push(key);
    }
  }

  for (const key of OPTIONAL_VARS) {
    const val = process.env[key];
    if (val === undefined || val === null || String(val).trim() === '') {
      missingOptional.push(key);
    }
  }

  if (missingOptional.length > 0) {
    console.warn('⚠️ Missing optional environment variables:');
    for (const key of missingOptional) {
      console.warn(`   • ${key}`);
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
      console.error('❌ Missing required environment variables:');
      for (const key of missingRequired) {
        console.error(`   • ${key}`);
      }
    }
    if (typeErrors.length > 0) {
      console.error('❌ Invalid environment variable types:');
      for (const err of typeErrors) {
        console.error(`   • ${err}`);
      }
    }

    process.exit(1);
  }

  // Validate DATABASE_URL format
  const dbUrl = process.env.DATABASE_URL;
  let isDbUrlValid = false;
  try {
    const parsed = new URL(dbUrl);
    if (parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:') {
      isDbUrlValid = true;
    }
  } catch (err) {
    // URL parsing failed
  }

  if (!isDbUrlValid) {
    console.error('❌ Invalid environment variable format:');
    console.error(
      '   • DATABASE_URL must be a valid PostgreSQL connection string starting with postgres:// or postgresql://'
    );
    process.exit(1);
  }
}

module.exports = validateEnv;
