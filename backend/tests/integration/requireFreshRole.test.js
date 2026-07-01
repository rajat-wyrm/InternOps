const requireFreshRole = require('../../src/middleware/requireFreshRole');
const pool = require('../../src/config/db');
const { v4: uuidv4 } = require('uuid');

describe('requireFreshRole Middleware (#484)', () => {
  let testUserId;
  const TEST_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$abc123'; // dummy hash

  beforeEach(async () => {
    testUserId = uuidv4();
    // Create a test user
    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, full_name, suspended, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)
       ON CONFLICT (id) DO UPDATE SET role = $4, suspended = $6`,
      [
        testUserId,
        `test-user-${testUserId}@internops.com`,
        TEST_PASSWORD_HASH,
        'SENIOR_TL',
        'Test User',
        false,
      ]
    );
  });

  afterEach(async () => {
    // Cleanup
    try {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    } catch (e) {
      // Ignore
    }
  });

  it('should update req.user.role with fresh DB value when not suspended', async () => {
    // Setup: mock request and reply objects
    const request = {
      user: { id: testUserId, role: 'ADMIN' }, // Stale role (not actually ADMIN in DB)
    };
    const reply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    // Call middleware
    await requireFreshRole(request, reply);

    // Assertions
    expect(request.user.role).toBe('SENIOR_TL'); // Fresh from DB
    expect(reply.status).not.toHaveBeenCalled(); // No error response
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('should reject user with 401 when user is suspended', async () => {
    // Suspend the user in DB
    await pool.query('UPDATE users SET suspended = true WHERE id = $1', [
      testUserId,
    ]);

    const request = {
      user: { id: testUserId, role: 'SENIOR_TL' },
    };
    const reply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await requireFreshRole(request, reply);

    // Assertions
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Invalid session' });
  });

  it('should reject user with 401 when user is deleted', async () => {
    // Delete the user in DB
    await pool.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [
      testUserId,
    ]);

    const request = {
      user: { id: testUserId, role: 'SENIOR_TL' },
    };
    const reply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await requireFreshRole(request, reply);

    // Assertions
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Invalid session' });
  });

  it('should reject user with 401 when user does not exist', async () => {
    const nonExistentId = uuidv4();

    const request = {
      user: { id: nonExistentId, role: 'SENIOR_TL' },
    };
    const reply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await requireFreshRole(request, reply);

    // Assertions
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Invalid session' });
  });

  it('should handle role demotion - stale JWT becomes current', async () => {
    // Simulate role demotion in DB
    await pool.query("UPDATE users SET role = 'CAPTAIN' WHERE id = $1", [
      testUserId,
    ]);

    const request = {
      user: { id: testUserId, role: 'SENIOR_TL' }, // Stale JWT still says SENIOR_TL
    };
    const reply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await requireFreshRole(request, reply);

    // Middleware should overwrite with fresh role
    expect(request.user.role).toBe('CAPTAIN'); // Fresh from DB
    expect(reply.status).not.toHaveBeenCalled();
  });
});
