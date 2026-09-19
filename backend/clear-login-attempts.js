const pool = require('./src/config/db');

async function main() {
  try {
    const result = await pool.query(
      'DELETE FROM login_attempts WHERE email = $1 AND success = false',
      ['admin@internops.com']
    );

    console.log('Deleted failed attempts:', result.rowCount);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
