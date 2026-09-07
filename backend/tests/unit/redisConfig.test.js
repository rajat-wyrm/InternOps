jest.mock('pino', () =>
  jest.fn(() => ({
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }))
);

jest.mock('../../src/config/testDatabase', () => ({
  resolveDatabaseUrl: jest.fn(() => 'postgresql://localhost/internops_test'),
}));

describe('Redis configuration', () => {
  const originalEnv = { ...process.env };

  function loadRedisConfig(redisEnv = {}) {
    process.env = {
      NODE_ENV: 'development',
      JWT_SECRET: 'test-secret',
      DATABASE_URL: 'postgresql://localhost/internops',
      ...redisEnv,
    };
    jest.resetModules();
    return require('../../src/config').redis;
  }

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('uses REDIS_URL as the canonical configuration', () => {
    const redis = loadRedisConfig({
      REDIS_URL: 'rediss://app:secret@example.redis.test:6380/2',
      REDIS_HOST: 'ignored-host',
    });

    expect(redis).toMatchObject({
      enabled: true,
      available: false,
      source: 'REDIS_URL',
      host: 'example.redis.test',
      port: 6380,
      username: 'app',
      password: 'secret',
      database: 2,
      tls: true,
    });
  });

  test('supports host-based configuration when REDIS_URL is absent', () => {
    const redis = loadRedisConfig({
      REDIS_HOST: 'redis',
      REDIS_PORT: '6379',
      REDIS_DB: '3',
      REDIS_TLS: 'false',
    });

    expect(redis).toMatchObject({
      enabled: true,
      available: false,
      source: 'REDIS_HOST',
      host: 'redis',
      port: 6379,
      database: 3,
      tls: false,
    });
  });

  test('disables Redis when no supported configuration is present', () => {
    const redis = loadRedisConfig();

    expect(redis).toMatchObject({
      enabled: false,
      available: false,
      source: null,
      host: null,
    });
  });
});
