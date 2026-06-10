const { Pool } = require('pg');
const config = require('./index');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
});

// Errors emitted by idle clients in the pool (e.g. a transient network blip
// or the database closing an idle connection) must not crash the server.
// pg removes the failed client from the pool automatically and a fresh one is
// created on the next query, so we log and keep running.
pool.on('error', (err) => {
  console.error('Unexpected error on idle DB client:', err);
});

module.exports = pool;