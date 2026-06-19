const { Pool } = require('pg');
const config = require('./index');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.dbHealthy = true;

pool.on('error', (err) => {
  console.error('DB pool error:', err);
  pool.dbHealthy = false;
});

// Pool reconnection monitoring
setInterval(async () => {
  if (!pool.dbHealthy) {
    try {
      await pool.query('SELECT 1');
      pool.dbHealthy = true;
      console.log('Database connection recovered successfully.');
    } catch (err) {
      // Still disconnected
    }
  }
}, 5000).unref();

module.exports = pool;
