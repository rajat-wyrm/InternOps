const { isDirectManager, isValidStep } = require('../utils/hierarchy');
const pool = require('../config/db');
function directManagerValidation(field = 'user_id') {
  return async (request, reply) => {
    const target = request.params[field] ?? request.body?.[field];
    if (!target) return reply.status(400).send({ error: 'Target required' });
    const {
      rows: [user],
    } = await pool.query(
      'SELECT id, role, manager_id FROM users WHERE id = $1 FOR UPDATE',
      [target]
    );
    if (!user) return reply.status(404).send({ error: 'User not found' });
    const { isValidStep } = require('../utils/hierarchy');
    if (
      user.manager_id !== request.user.id ||
      !isValidStep(request.user.role, user.role)
    ) {
      return reply
        .status(403)
        .send({ error: 'Not your direct report or invalid step' });
    }
    request.resolvedTarget = target;
  };
}
module.exports = directManagerValidation;
