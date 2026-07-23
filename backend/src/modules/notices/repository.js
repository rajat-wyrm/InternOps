const pool = require('../../config/db');

// Only safe, public-facing columns — never SELECT *
const PUBLIC_COLUMNS = `
  id, title, content, category, created_at
`;

async function getActiveNotices() {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS}
     FROM notices
     WHERE is_active = TRUE
       AND deleted_at IS NULL
     ORDER BY created_at DESC`
  );
  return rows;
}

async function getAllNotices({ page = 1, limit = 50 } = {}) {
  const safeLimit = Math.min(Number(limit) || 50, 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const { rows } = await pool.query(
    'SELECT * FROM notices WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [safeLimit, offset]
  );
  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*) FROM notices WHERE deleted_at IS NULL'
  );
  return {
    data: rows,
    total: parseInt(countRows[0].count, 10),
    page: safePage,
    limit: safeLimit,
  };
}

async function createNotice({
  title,
  content,
  category = 'GENERAL',
  createdBy,
}) {
  const { rows } = await pool.query(
    `INSERT INTO notices (title, content, category, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, content, category, is_active, created_at`,
    [title, content, category, createdBy]
  );
  return rows[0];
}

async function updateNotice(id, { title, content, category, is_active }) {
  const { rows } = await pool.query(
    `UPDATE notices
     SET title      = COALESCE($1, title),
         content    = COALESCE($2, content),
         category   = COALESCE($3, category),
         is_active  = COALESCE($4, is_active),
         updated_at = NOW()
     WHERE id = $5
       AND deleted_at IS NULL
     RETURNING id, title, content, category, is_active, updated_at`,
    [title, content, category, is_active, id]
  );
  return rows[0] ?? null; // null = not found or already deleted
}

async function softDeleteNotice(id) {
  const { rows } = await pool.query(
    `UPDATE notices
     SET deleted_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id`,
    [id]
  );
  return rows[0] ?? null;
}

module.exports = {
  getActiveNotices,
  createNotice,
  updateNotice,
  softDeleteNotice,
  getAllNotices,
};
