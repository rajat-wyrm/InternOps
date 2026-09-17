// Seed only the configured Admin account.
require('dotenv').config();
const pool = require('../src/config/db');
const argon2 = require('argon2');

async function seed() {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production' && process.env.ALLOW_SEED_IN_PRODUCTION !== 'true') {
    throw new Error(
      'Refusing to seed in production without ALLOW_SEED_IN_PRODUCTION=true.'
    );
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPass = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPass) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const admin = await client.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [adminEmail]
    );
    if (admin.rowCount === 0) {
      const hash = await argon2.hash(adminPass);
      await client.query(
        'INSERT INTO users (email, password_hash, role, full_name) VALUES ($1, $2, $3, $4)',
        [adminEmail, hash, 'ADMIN', 'System Admin']
      );
    }

    await client.query('COMMIT');
    console.log('Seed completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    pool.end().finally(() => process.exit(1));
  });
