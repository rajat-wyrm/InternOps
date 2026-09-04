require('dotenv').config();
const pool = require('../src/config/db');
const argon2 = require('argon2');

async function seedInternAndAssessment() {
  const client = await pool.connect();
  try {
    console.log('Starting seed-intern script...');

    // Check if captain exists
    let captainId;
    const existingCaptain = await client.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      ['captain@internops.com']
    );

    if (existingCaptain.rowCount > 0) {
      captainId = existingCaptain.rows[0].id;
      console.log('Captain already exists.');
    } else {
      const captainHash = await argon2.hash('Password@123');
      const insertCaptain = await client.query(
        "INSERT INTO users (email, password_hash, role, full_name) VALUES ($1, $2, 'CAPTAIN', 'Alice Captain') RETURNING id",
        ['captain@internops.com', captainHash]
      );
      captainId = insertCaptain.rows[0].id;
      console.log('Captain Alice Captain created.');
    }

    // Check if intern exists
    let internId;
    const existingIntern = await client.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      ['intern@internops.com']
    );

    if (existingIntern.rowCount > 0) {
      internId = existingIntern.rows[0].id;
      console.log('Intern already exists.');
    } else {
      const internHash = await argon2.hash('Password@123');
      const insertIntern = await client.query(
        "INSERT INTO users (email, password_hash, role, manager_id, full_name) VALUES ($1, $2, 'INTERN', $3, 'Jane Doe') RETURNING id",
        ['intern@internops.com', internHash, captainId]
      );
      internId = insertIntern.rows[0].id;
      console.log('Intern Jane Doe created.');
    }

    // Insert dummy assessment for Jane Doe if not exists
    const existingAssessment = await client.query(
      'SELECT id FROM assessments WHERE user_id = $1',
      [internId]
    );

    if (existingAssessment.rowCount > 0) {
      console.log('Assessment for Jane Doe already exists. Skipping.');
    } else {
      await client.query(
        `INSERT INTO assessments (
          user_id, 
          score, 
          category, 
          status, 
          questions_count, 
          key_strengths, 
          improvement_areas, 
          next_actions, 
          feedback
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          internId,
          85,
          'Excellent',
          'COMPLETED',
          50,
          ['JavaScript Core', 'React Components', 'Problem Solving'],
          ['SQL Optimization', 'CI/CD Deployment'],
          ['Complete SQL indexing module', 'Deploy Vite to staging'],
          'Jane shows strong performance in React and UI components design. Her core JavaScript knowledge is solid, but she needs to focus more on backend SQL queries optimization.',
        ]
      );
      console.log('Jane Doe Assessment seeded successfully!');
    }
  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    client.release();
  }
}

seedInternAndAssessment()
  .then(() => pool.end())
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Unhandled seed error:', e);
    pool.end().finally(() => process.exit(1));
  });
