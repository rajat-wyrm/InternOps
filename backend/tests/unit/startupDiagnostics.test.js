const {
  sanitizeDatabaseTarget,
  checkDatabase,
  integrationStatus,
} = require('../../src/utils/startupDiagnostics');

describe('startup diagnostics', () => {
  test('sanitizes a Neon connection string without exposing credentials', () => {
    const result = sanitizeDatabaseTarget(
      'postgresql://user:secret@ep-example.neon.tech/internops?sslmode=require'
    );
    expect(result).toEqual({
      provider: 'Neon',
      host: 'ep-example.neon.tech',
      database: 'internops',
      ssl: true,
    });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  test('checks the database and uses the server-reported database name', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({
        rows: [{ database: 'internops_test', ssl: 'on' }],
      }),
    };
    await expect(
      checkDatabase(pool, 'postgresql://user:secret@localhost/postgres')
    ).resolves.toMatchObject({ database: 'internops_test', ssl: true });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('reports optional integrations without returning secrets', () => {
    const result = integrationStatus({
      email: { apiKey: 'secret' },
      ai: { fastapiUrl: 'http://localhost:8000' },
      sentry: { dsn: null },
    });
    expect(result).toMatchObject({ email: true, ai: true, sentry: false });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
