const { Pool } = require('pg');
const config = require('./index');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('DB pool error:', err);
});

module.exports = pool;
