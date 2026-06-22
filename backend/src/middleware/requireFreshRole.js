const pool = require('../config/db');

/**
 * Re-fetches the requester's role/suspended status from the DB instead of
 * trusting the JWT claim, closing the stale-role window (up to access-token
 * TTL) for sensitive operations like role changes, suspensions, etc.
 */
async function requireFreshRole(request, reply) {
  const { rows } = await pool.query(
    'SELECT role, suspended FROM users WHERE id = $1 AND deleted_at IS NULL',
    [request.user.id]
  );
  if (!rows[0] || rows[0].suspended) {
    return reply.status(401).send({ error: 'Invalid session' });
  }
  request.user.role = rows[0].role; // overwrite stale JWT claim with current DB value
}

module.exports = requireFreshRole;
