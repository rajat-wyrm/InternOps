const { Pool } = require('pg');
const config = require('./index');
const logger = require('../logger');

const databaseUrl = process.env.DATABASE_URL || config.databaseUrl;

const poolConfig = {
  max: config.dbPoolMax || 20,
  idleTimeoutMillis: 30000,
  // Serverless Postgres (Neon) cold starts can exceed the default 10 s.
  // A 30 s timeout prevents connection failures during scale-from-zero.
  connectionTimeoutMillis: 30000,
};

if (databaseUrl) {
  poolConfig.connectionString = databaseUrl;
} else {
  poolConfig.host = process.env.DB_HOST;
  poolConfig.port = process.env.DB_PORT
    ? Number.parseInt(process.env.DB_PORT, 10)
    : undefined;
  poolConfig.user = process.env.DB_USER || 'postgres';
  poolConfig.password = process.env.DB_PASSWORD;
  poolConfig.database = process.env.DB_NAME;
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle database client');
});

module.exports = pool;
