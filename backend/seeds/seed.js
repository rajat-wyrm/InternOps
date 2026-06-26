// ✅ Guard against production execution and add safety logging:
require('dotenv').config();
const pool = require('../src/config/db');
const argon2 = require('argon2');

async function seedAdmin() {
  // ✅ Block production runs unless explicitly overridden:
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production' && process.env.ALLOW_SEED_IN_PRODUCTION !== 'true') {
    console.error(
      '❌ Refusing to seed in production. Set ALLOW_SEED_IN_PRODUCTION=true to override.'
    );
    process.exit(1);
  }

  // ✅ Fail fast if required env vars are missing — no silent fallback:
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPass = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPass) {
    console.error(
      '❌ SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set. Refusing to use defaults.'
    );
    process.exit(1);
  }

  // ✅ Log target environment so operator can confirm before proceeding:
  console.log(`⚠️  Seeding admin in environment: ${env}`);
  console.log(
    `⚠️  Target host: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`
  );

  const client = await pool.connect();
  try {
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [adminEmail]
    );
    if (existing.rowCount > 0) {
      console.log('ℹ️  Admin user already exists — skipping.');
      return;
    }
    const hash = await argon2.hash(adminPass);
    await client.query(
      'INSERT INTO users (email, password_hash, role, full_name) VALUES ($1,$2,$3,$4)',
      [adminEmail, hash, 'ADMIN', 'System Admin']
    );
    console.log('✅ Admin user seeded successfully.');
  } finally {
    client.release();
  }
}

seedAdmin()
  .then(() => pool.end()) // ✅ drain pool before exit
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    pool.end().finally(() => process.exit(1));
  });
