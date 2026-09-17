const pool = require('../../config/db');

async function listInterns({ search = '', page = 1, limit = 100 } = {}) {
  const offset = (page - 1) * limit;
  const q = String(search || '').trim();

  const params = [];
  let where = '';

  if (q) {
    params.push(`%${q}%`);

    where = `
      WHERE intern_code ILIKE $1
         OR full_name ILIKE $1
         OR COALESCE(email_id, '') ILIKE $1
         OR COALESCE(domain, '') ILIKE $1
    `;
  }

  params.push(limit);
  params.push(offset);

  const result = await pool.query(
    `
      SELECT
        id,
        serial_no,
        record_date,
        intern_code,
        full_name,
        email_id,
        mobile_no,
        domain,
        start_date,
        end_date
      FROM interns
      ${where}
      ORDER BY serial_no ASC, id ASC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params
  );

  const countParams = q ? [`%${q}%`] : [];

  const countWhere = q
    ? `
      WHERE intern_code ILIKE $1
         OR full_name ILIKE $1
         OR COALESCE(email_id, '') ILIKE $1
         OR COALESCE(domain, '') ILIKE $1
    `
    : '';

  const countResult = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM interns
      ${countWhere}
    `,
    countParams
  );

  return {
    data: result.rows,
    total: countResult.rows[0].total,
    page,
    limit,
  };
}

async function createIntern(data) {
  try {
    const { rows } = await pool.query(
      `
        INSERT INTO interns (
          serial_no,
          record_date,
          intern_code,
          full_name,
          email_id,
          mobile_no,
          domain,
          start_date,
          end_date
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
      `,
      [
        data.serial_no,
        data.record_date || null,
        data.intern_code,
        data.full_name,
        data.email_id || null,
        data.mobile_no || null,
        data.domain || null,
        data.start_date || null,
        data.end_date || null,
      ]
    );

    return rows[0];
  } catch (error) {
    if (error.code === '23505') {
      const err = new Error('Intern code already exists');
      err.statusCode = 409;
      throw err;
    }

    throw error;
  }
}

async function updateIntern(id, data) {
  try {
    const { rows } = await pool.query(
      `
        UPDATE interns
        SET
          serial_no = $1,
          record_date = $2,
          intern_code = $3,
          full_name = $4,
          email_id = $5,
          mobile_no = $6,
          domain = $7,
          start_date = $8,
          end_date = $9
        WHERE id = $10
        RETURNING *
      `,
      [
        data.serial_no,
        data.record_date || null,
        data.intern_code,
        data.full_name,
        data.email_id || null,
        data.mobile_no || null,
        data.domain || null,
        data.start_date || null,
        data.end_date || null,
        id,
      ]
    );

    return rows[0] || null;
  } catch (error) {
    if (error.code === '23505') {
      const err = new Error('Intern code already exists');
      err.statusCode = 409;
      throw err;
    }

    throw error;
  }
}

async function deleteIntern(id) {
  const result = await pool.query('DELETE FROM interns WHERE id = $1', [id]);

  return result.rowCount > 0;
}

module.exports = {
  listInterns,
  createIntern,
  updateIntern,
  deleteIntern,
};
