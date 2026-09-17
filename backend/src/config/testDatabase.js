function normalizedDatabaseTarget(value, variableName) {
  if (!value || !String(value).trim()) {
    throw new Error(`${variableName} is required for backend tests.`);
  }

  let parsed;
  try {
    parsed = new URL(String(value).trim());
  } catch {
    throw new Error(
      `${variableName} must be a valid PostgreSQL connection URL.`
    );
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`${variableName} must use postgres:// or postgresql://.`);
  }

  return `${parsed.protocol}//${parsed.hostname.toLowerCase()}:${parsed.port || '5432'}${parsed.pathname}`;
}

function resolveDatabaseUrl(env = process.env) {
  if (env.NODE_ENV !== 'test') return env.DATABASE_URL;

  const testUrl = env.TEST_DATABASE_URL;
  const normalUrl = env.DATABASE_URL;
  const testTarget = normalizedDatabaseTarget(testUrl, 'TEST_DATABASE_URL');

  if (normalUrl) {
    const normalTarget = normalizedDatabaseTarget(normalUrl, 'DATABASE_URL');
    if (testTarget === normalTarget) {
      throw new Error(
        'Unsafe backend test database configuration: TEST_DATABASE_URL points to the same database as DATABASE_URL.'
      );
    }
  }

  return testUrl;
}

function activateTestDatabase(env = process.env) {
  return resolveDatabaseUrl(env);
}

module.exports = {
  activateTestDatabase,
  normalizedDatabaseTarget,
  resolveDatabaseUrl,
};
