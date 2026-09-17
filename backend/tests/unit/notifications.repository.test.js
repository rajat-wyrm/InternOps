jest.mock('../../src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/modules/audit/repository', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

const pool = require('../../src/config/db');
const audit = require('../../src/modules/audit/repository');
const {
  notifyAdmin,
  bulkSend,
} = require('../../src/modules/notifications/repository');

describe('notifications repository - notifyAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('notifies multiple admins using a single batch insert via bulkSend and logs audit events', async () => {
    const adminIds = ['admin-1', 'admin-2', 'admin-3'];
    const message = '⚠️ System alert: High CPU usage';

    // Mock query response for SELECT DISTINCT id FROM users WHERE role = 'ADMIN'...
    pool.query
      .mockResolvedValueOnce({
        rows: adminIds.map((id) => ({ id })),
      })
      // Mock query response for bulkSend batch INSERT
      .mockResolvedValueOnce({
        rows: adminIds.map((id) => ({
          id: `notif-${id}`,
          user_id: id,
          message,
        })),
      });

    await notifyAdmin(message);

    // 1. SELECT query to get admins
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("WHERE role = 'ADMIN'")
    );

    // 2. Single batch INSERT query via bulkSend instead of N queries
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO notifications'),
      ['admin-1', message, 'admin-2', message, 'admin-3', message]
    );

    // 3. Pool query should be called exactly twice total (1 SELECT + 1 batch INSERT)
    expect(pool.query).toHaveBeenCalledTimes(2);

    // 4. Audit event logged for each admin
    expect(audit.logEvent).toHaveBeenCalledTimes(3);
    adminIds.forEach((adminId, index) => {
      expect(audit.logEvent).toHaveBeenNthCalledWith(index + 1, {
        userId: adminId,
        action: 'ADMIN_NOTIFIED',
        details: { message },
      });
    });
  });

  it('returns early without sending notifications if no admins exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await notifyAdmin('Test message');

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(audit.logEvent).not.toHaveBeenCalled();
  });
});
