const pool = require('../../config/db');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');

async function routes(fastify) {

  fastify.get('/attendance-summary', {
    preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')]
  }, async (req) => {
    const { from, to } = req.query;
    if (!from || !to) throw new Error('from and to dates required');
    return repo.attendanceSummaryByRole(from, to);
  });

  fastify.get('/ratings-summary', {
    preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')]
  }, async (req) => {
    const { from, to } = req.query;
    if (!from || !to) throw new Error('from and to dates required');
    return repo.ratingsSummary(from, to);
  });

  fastify.get('/task-completion', {
    preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')]
  }, async () => {
    return repo.taskCompletionStats();
  });

  fastify.get('/department-attendance', {
    preHandler: [auth, rbac('ADMIN')]
  }, async (req) => {

    const { from, to, departmentId } = req.query;

    let query = `
      SELECT d.name AS department,
             COUNT(a.id) AS total,
             SUM(CASE WHEN a.status='PRESENT' THEN 1 ELSE 0 END) AS present,
             SUM(CASE WHEN a.status='ABSENT' THEN 1 ELSE 0 END) AS absent,
             SUM(CASE WHEN a.status='HALF_DAY' THEN 1 ELSE 0 END) AS half_day
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      JOIN departments d ON u.department_id = d.id
      WHERE a.deleted_at IS NULL
    `;

    const params = [];

    if (from) {
      query += ` AND a.date >= $${params.length + 1}`;
      params.push(from);
    }

    if (to) {
      query += ` AND a.date <= $${params.length + 1}`;
      params.push(to);
    }

    if (departmentId) {
      query += ` AND d.id = $${params.length + 1}`;
      params.push(departmentId);
    }

    query += ` GROUP BY d.id, d.name ORDER BY d.name`;

    const { rows } = await pool.query(query, params);
    return rows;
  });

  fastify.get('/custom-summary', {
    preHandler: [auth, rbac('ADMIN')]
  }, async (req) => {

    const { from, to } = req.query;

    if (!from || !to) {
      throw new Error('from and to dates required');
    }

    const { rows } = await pool.query(`
      SELECT DATE(a.date) AS date,
             COUNT(*) AS total,
             SUM(CASE WHEN a.status='PRESENT' THEN 1 ELSE 0 END) AS present,
             SUM(CASE WHEN a.status='ABSENT' THEN 1 ELSE 0 END) AS absent,
             SUM(CASE WHEN a.status='HALF_DAY' THEN 1 ELSE 0 END) AS half_day
      FROM attendance a
      WHERE a.date BETWEEN $1 AND $2
      AND a.deleted_at IS NULL
      GROUP BY DATE(a.date)
      ORDER BY DATE(a.date)
    `, [from, to]);

    return rows;
  });

}

module.exports = routes;
