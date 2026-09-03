const assert = require('node:assert/strict');
const {
  activateTestDatabase,
  normalizedDatabaseTarget,
  resolveDatabaseUrl,
} = require('../src/config/testDatabase');

assert.throws(
  () =>
    resolveDatabaseUrl({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://dev/dev',
    }),
  /TEST_DATABASE_URL is required/
);
assert.throws(
  () =>
    resolveDatabaseUrl({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:one@db.example.com/app?sslmode=require',
      TEST_DATABASE_URL:
        'postgresql://other:two@db.example.com/app?sslmode=verify-full',
    }),
  /same database as DATABASE_URL/
);
assert.throws(
  () =>
    resolveDatabaseUrl({
      NODE_ENV: 'test',
      TEST_DATABASE_URL: 'https://example.com/db',
    }),
  /must use postgres/
);
const isolated = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://dev.example.com/app',
  TEST_DATABASE_URL: 'postgresql://test.example.com/app_test',
};
const normalDatabaseUrl = isolated.DATABASE_URL;

assert.equal(resolveDatabaseUrl(isolated), isolated.TEST_DATABASE_URL);
assert.equal(activateTestDatabase(isolated), isolated.TEST_DATABASE_URL);
assert.equal(isolated.DATABASE_URL, normalDatabaseUrl);
assert.notEqual(isolated.DATABASE_URL, isolated.TEST_DATABASE_URL);
assert.equal(
  normalizedDatabaseTarget(
    'postgresql://user:pass@Host.Example.com:5432/app?sslmode=require',
    'URL'
  ),
  'postgresql://host.example.com:5432/app'
);
assert.equal(
  resolveDatabaseUrl({
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://dev/app',
  }),
  'postgresql://dev/app'
);
console.log('[OK] Test database isolation guard checks passed.');
