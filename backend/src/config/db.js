const { Pool } = require('pg');
const config = require('./index');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('DB pool error:', err);
});

// Safeguard pool.end to make it idempotent and prevent "Called end on pool more than once" errors
const originalEnd = pool.end.bind(pool);
pool.end = async function () {
  if (pool.ending) return;
  return originalEnd();
};

module.exports = pool;
