require('dotenv').config();

const pool = require('../src/config/db');

const departments = [
  'Artificial Intelligence & Machine Learning',
  'Computer Science',
  'Data Science',
  'Information Technology',
  'Information Systems',
  'Cyber Security',
  'Cloud Computing',
  'DevOps',
  'Software Engineering',
  'Electronics & Communication Engineering',
  'Electrical & Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Business Administration',
  'Human Resources',
  'Finance',
  'Marketing',
  'Sales',
  'Operations',
  'Research & Development',
  'Product Management',
  'Quality Assurance',
  'Customer Support',
  'Legal & Compliance',
  'Administration',
];

async function seedDepartments() {
  const client = await pool.connect();

  try {
    console.log('Creating departments...');

    // Get an existing admin user to use as created_by
    const adminResult = await client.query(`
      SELECT id
      FROM users
      WHERE role = 'ADMIN'
        AND deleted_at IS NULL
      ORDER BY id
      LIMIT 1
    `);

    if (adminResult.rows.length === 0) {
      throw new Error('No active ADMIN user found.');
    }

    const adminId = adminResult.rows[0].id;

    for (const name of departments) {
      await client.query(
        `
        INSERT INTO departments (name, created_by)
        VALUES ($1, $2)
        ON CONFLICT (name) DO NOTHING
        `,
        [name, adminId]
      );

      console.log(`Department checked: ${name}`);
    }

    const result = await client.query(`
      SELECT id, name
      FROM departments
      WHERE deleted_at IS NULL
      ORDER BY name
    `);

    console.log('\nDepartments currently in database:');

    console.table(result.rows);
  } catch (error) {
    console.error('ERROR:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDepartments();
