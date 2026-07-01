const pool = require('../config/db');

async function withHierarchyTx(userIdsToLock, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (userIdsToLock && userIdsToLock.length > 0) {
      // Sort IDs to consistently lock in the same order and prevent deadlocks
      const sortedIds = [...new Set(userIdsToLock)].sort();
      await client.query('SELECT id FROM users WHERE id = ANY($1) FOR UPDATE', [
        sortedIds,
      ]);
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withHierarchyTx };
