const mockConfig = {
  redis: {
    enabled: false,
    available: false,
    host: null,
  },
};
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
};

jest.mock('../../src/config', () => mockConfig);
jest.mock('../../src/logger', () => mockLogger);
jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

const {
  getRedisDegradedFeatures,
  getRedisStatus,
  runRedisOperation,
} = require('../../src/config/redis');

describe('Redis graceful fallback', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('short-circuits an operation and logs its fallback only once', async () => {
    const operation = jest.fn();

    await expect(
      runRedisOperation(
        'session cache read',
        'reading from PostgreSQL',
        operation,
        'fallback-value'
      )
    ).resolves.toBe('fallback-value');

    await runRedisOperation(
      'session cache read',
      'reading from PostgreSQL',
      operation,
      'fallback-value'
    );

    expect(operation).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockConfig.redis.available).toBe(false);
    expect(getRedisStatus()).toBe('disabled');
  });

  test('reports the features affected by the missing optional dependency', () => {
    const features = getRedisDegradedFeatures();

    expect(features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ feature: 'rate limiting' }),
        expect.objectContaining({ feature: 'session cache' }),
        expect.objectContaining({ feature: 'access-token revocation' }),
        expect.objectContaining({ feature: 'bulk job queue' }),
      ])
    );
  });
});
