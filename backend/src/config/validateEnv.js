const REQUIRED_VARS = ['JWT_SECRET', 'DATABASE_URL', 'NODE_ENV'];

const OPTIONAL_VARS = ['REDIS_URL', 'GOOGLE_CLIENT_ID', 'EMAIL_API_KEY'];

function validateEnv() {
  // Skip validation in test environment
  if (process.env.NODE_ENV === 'test') {
    return;
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

  if (missingRequired.length > 0) {
    console.error('❌ Missing required environment variables:');
    for (const key of missingRequired) {
      console.error(`   • ${key}`);
    }

    process.exit(1);
  }
}

module.exports = validateEnv;
