// Seed the CI/admin account and deterministic assessment demo data.
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

    let captainId;
    const captain = await client.query(
      "SELECT id FROM users WHERE email = 'captain@internops.com' AND deleted_at IS NULL"
    );
    if (captain.rowCount > 0) {
      captainId = captain.rows[0].id;
    } else {
      const hash = await argon2.hash('Password@123');
      const inserted = await client.query(
        "INSERT INTO users (email, password_hash, role, full_name) VALUES ('captain@internops.com', $1, 'CAPTAIN', 'Alice Captain') RETURNING id",
        [hash]
      );
      captainId = inserted.rows[0].id;
    }

    let internId;
    const intern = await client.query(
      "SELECT id FROM users WHERE email = 'intern@internops.com' AND deleted_at IS NULL"
    );
    if (intern.rowCount > 0) {
      internId = intern.rows[0].id;
    } else {
      const hash = await argon2.hash('Password@123');
      const inserted = await client.query(
        "INSERT INTO users (email, password_hash, role, manager_id, full_name) VALUES ('intern@internops.com', $1, 'INTERN', $2, 'Jane Doe') RETURNING id",
        [hash, captainId]
      );
      internId = inserted.rows[0].id;
    }

    const assessment = await client.query(
      'SELECT id FROM assessments WHERE user_id = $1 LIMIT 1',
      [internId]
    );
    if (assessment.rowCount === 0) {
      await client.query(
        `INSERT INTO assessments (
          user_id, score, category, status, questions_count,
          key_strengths, improvement_areas, next_actions, feedback
        ) VALUES ($1, 85, 'Excellent', 'COMPLETED', 50, $2, $3, $4, $5)`,
        [
          internId,
          ['JavaScript Core', 'React Components', 'Problem Solving'],
          ['SQL Optimization', 'CI/CD Deployment'],
          ['Complete SQL indexing module', 'Deploy Vite to staging'],
          'Jane shows strong performance in React and UI component design. Her core JavaScript knowledge is solid, but she should focus more on backend SQL query optimization.',
        ]
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
