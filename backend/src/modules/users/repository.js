// backend/src/modules/users/repository.js

class UserRepository {
  constructor(db) {
    this.db = db; // Database pool from config/db
  }

  async findPaginated({ page, limit, search, sortBy, sortOrder }) {
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params = [];

    // Build WHERE clause for search
    if (search) {
      whereClause = `WHERE (u.name ILIKE $1 OR u.email ILIKE $1)`;
      params.push(`%${search}%`);
    }

    // Whitelist allowed sort columns to prevent SQL injection
    const allowedSortColumns = ['name', 'created_at', 'last_login'];
    const orderColumn = allowedSortColumns.includes(sortBy)
      ? sortBy
      : 'created_at';
    const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Get total count for pagination metadata
    const countQuery = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
    const totalResult = await this.db.query(countQuery, params);
    const total = parseInt(totalResult.rows[0].total, 10);

    // Get paginated and sorted data
    const dataQuery = `
      SELECT u.id, u.name, u.email, u.role, u.created_at, u.last_login
      FROM users u
      ${whereClause}
      ORDER BY ${orderColumn} ${orderDirection}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const dataParams = [...params, limit, offset];
    const dataResult = await this.db.query(dataQuery, dataParams);

    return {
      data: dataResult.rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  async create(userData) {
    const { name, email, password, role = 'INTERN' } = userData;
    const query = `
      INSERT INTO users (name, email, password, role, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, name, email, role, created_at
    `;
    const result = await this.db.query(query, [name, email, password, role]);
    return result.rows[0];
  }

  async update(id, updates) {
    const { name, email, role } = updates;
    const query = `
      UPDATE users 
      SET name = COALESCE($1, name), 
          email = COALESCE($2, email), 
          role = COALESCE($3, role),
          updated_at = NOW()
      WHERE id = $4
      RETURNING id, name, email, role, created_at, updated_at
    `;
    const result = await this.db.query(query, [name, email, role, id]);
    return result.rows[0] || null;
  }

  async delete(id) {
    const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
    const result = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }
}

module.exports = UserRepository;
