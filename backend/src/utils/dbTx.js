async function dbTx(fn) {
  let client;
  let destroyClient = false;

  try {
    client = await pool.connect();

    await client.query('BEGIN');

    const result = await fn(client);

    await client.query('COMMIT');

    return result;
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        destroyClient = true;
      }
    }

    throw err;
  } finally {
    if (client) {
      client.release(destroyClient);
    }
  }
}

async function withHierarchyTx(userIdsToLock, fn) {
  let client;
  let destroyClient = false;

  try {
    client = await pool.connect();

    await client.query('BEGIN');

    if (userIdsToLock && userIdsToLock.length > 0) {
      const sortedIds = [...new Set(userIdsToLock)].sort();

      await client.query('SELECT id FROM users WHERE id = ANY($1) FOR UPDATE', [
        sortedIds,
      ]);
    }

    const result = await fn(client);

    await client.query('COMMIT');

    return result;
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        destroyClient = true;
      }
    }

    throw err;
  } finally {
    if (client) {
      client.release(destroyClient);
    }
  }
}
