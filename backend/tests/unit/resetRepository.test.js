jest.mock('../../src/config/db', () => ({
  connect: jest.fn(),
  query: jest.fn(),
}));

jest.mock('../../src/modules/auth/repository', () => ({
  revokeAllUserTokensRedis: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

const pool = require('../../src/config/db');
const argon2 = require('argon2');
const resetRepository = require('../../src/modules/auth/resetRepository');

describe('resetRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('locks the reset token row before consuming it', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };

    pool.connect.mockResolvedValue(client);
    client.query.mockResolvedValue({ rowCount: 0 });

    await resetRepository.resetPasswordAtomic('reset-token', 'NewPassword123!');

    const lockQuery = client.query.mock.calls.find(([sql]) =>
      sql.includes('FOR UPDATE')
    );
    expect(lockQuery).toBeDefined();
    expect(lockQuery[0]).toContain('SELECT id, user_id');
    expect(argon2.hash).not.toHaveBeenCalled();
  });
});
