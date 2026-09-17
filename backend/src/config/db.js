const { Pool } = require('pg');
const config = require('./index');
const logger = require('../logger');

const pool = new Pool({
  connectionString: config.databaseUrl || process.env.DATABASE_URL,
  max: config.dbPoolMax || 20,
  idleTimeoutMillis: 30000,
  // Serverless Postgres (Neon) cold starts can exceed the default 10 s.
  // A 30 s timeout prevents connection failures during scale-from-zero.
  connectionTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle database client');
});

module.exports = pool;
