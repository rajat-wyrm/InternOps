const pool = require('../../config/db');

async function createDepartment(name, createdBy) {
  try {
    const res = await pool.query(
      'INSERT INTO departments (name, created_by) VALUES ($1,$2) RETURNING *',
      [name, createdBy]
    );
    return res.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      const err = new Error('Department name already exists');
      err.status = 409;
      throw err;
    }
    throw error;
  }
}

async function getAll() {
  return (
    await pool.query(
      'SELECT * FROM departments WHERE deleted_at IS NULL ORDER BY name'
    )
  ).rows;
}

async function softDelete(id) {
  await pool.query(
    'UPDATE departments SET deleted_at=NOW(), updated_at=NOW() WHERE id=$1',
    [id]
  );
}

module.exports = { createDepartment, getAll, softDelete };
