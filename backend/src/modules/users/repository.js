const db = require('../../config/db');

class UserRepository {
  constructor(database = db) {
    this.db = database;
  }

  async findPaginated({ page, limit, search, sortBy, sortOrder }) {
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = `WHERE (u.name ILIKE $1 OR u.email ILIKE $1)`;
      params.push(`%${search}%`);
    }

    const allowedSortColumns = ['name', 'created_at', 'last_login'];
    const orderColumn = allowedSortColumns.includes(sortBy)
      ? sortBy
      : 'created_at';
    const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';

    const countQuery = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
    const totalResult = await this.db.query(countQuery, params);
    const total = parseInt(totalResult.rows[0].total, 10);

    const dataQuery = `
      SELECT u.id, u.name, u.email, u.role, u.created_at, u.last_login
      FROM users u
      ${whereClause}
      ORDER BY ${orderColumn} ${orderDirection}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const dataResult = await this.db.query(dataQuery, [
      ...params,
      limit,
      offset,
    ]);

    return {
      data: dataResult.rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id) {
    const result = await this.db.query('SELECT * FROM users WHERE id = $1', [
      id,
    ]);
    return result.rows[0] || null;
  }

  async create(userData) {
    const { name, email, password, role = 'INTERN' } = userData;

    const result = await this.db.query(
      `INSERT INTO users (name, email, password, role, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, name, email, role, created_at`,
      [name, email, password, role]
    );

    return result.rows[0];
  }
  async update(id, updates) {
    const {
      full_name = null,
      email = null,
      role = null,
      department_id = null,
      manager_id = null,
    } = updates;

    const result = await this.db.query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           email = COALESCE($2, email),
           role = COALESCE($3, role),
           department_id = $4,
           manager_id = $5,
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        full_name,
        email ? email.trim().toLowerCase() : null,
        role,
        department_id,
        manager_id,
        id,
      ]
    );

    return result.rows[0] || null;
  }
  async delete(id) {
    const result = await this.db.query(
      `UPDATE users
       SET full_name = 'Removed User',
           email = CONCAT('deleted+', id, '@deleted.local'),
           manager_id = NULL,
           department_id = NULL,
           suspended = TRUE,
           deleted_at = NOW(),
           must_change_password = FALSE
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    return result.rows[0] || null;
  }
}

module.exports = UserRepository;
