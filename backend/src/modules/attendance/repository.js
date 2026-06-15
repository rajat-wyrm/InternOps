const pool = require('../../config/db');

async function markAttendance(userId, markedBy, date, status, remarks) {
  const res = await pool.query(
    `INSERT INTO attendance (user_id, marked_by, date, status, remarks)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, date)
     DO UPDATE SET status=$4, marked_by=$2, remarks=$5, updated_at=NOW()
     RETURNING *`,
    [userId, markedBy, date, status, remarks || null]
  );
  return res.rows[0];
}

async function getAttendance(userId, { from, to, page = 1, limit = 30 } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const where = ['user_id=$1', 'deleted_at IS NULL'];
  const params = [userId];
  if (from) {
    params.push(from);
    where.push(`date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    where.push(`date <= $${params.length}`);
  }
  const whereClause = where.join(' AND ');

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM attendance WHERE ${whereClause}`,
    params
  );
  const total = countRes.rows[0].total;

  params.push(safeLimit, offset);
  const res = await pool.query(
    `SELECT * FROM attendance WHERE ${whereClause}
     ORDER BY date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { records: res.rows, total, page: safePage, limit: safeLimit };
}

async function getMonthlyStats(userId, month, year) {
  const res = await pool.query(
    `SELECT status, COUNT(*) as count
     FROM attendance
     WHERE user_id=$1 AND EXTRACT(MONTH FROM date)=$2 AND EXTRACT(YEAR FROM date)=$3 AND deleted_at IS NULL
     GROUP BY status`,
    [userId, month, year]
  );
  return res.rows;
}

async function bulkMark(entries, markedBy) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = [];
    for (const e of entries) {
      const r = await client.query(
        `INSERT INTO attendance (user_id, marked_by, date, status, remarks)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, date)
         DO UPDATE SET status=$4, marked_by=$2, remarks=$5, updated_at=NOW()
         RETURNING *`,
        [e.user_id, markedBy, e.date, e.status, e.remarks || null]
      );
      out.push(r.rows[0]);
    }
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { markAttendance, getAttendance, getMonthlyStats, bulkMark };
