require('dotenv').config();

const pool = require('./src/config/db');

pool
  .query(
    "SELECT id, email, role, suspended, deleted_at FROM users WHERE email = 'admin@internops.com'"
  )
  .then((r) => {
    console.log('USER FOUND:', r.rows);
  })
  .catch((e) => {
    console.error('DB ERROR:', e.message);
  })
  .finally(() => pool.end());
