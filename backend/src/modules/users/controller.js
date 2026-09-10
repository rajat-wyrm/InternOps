// backend/src/modules/users/controller.js

const UserService = require('./service');

class UserController {
  constructor(db) {
    this.service = new UserService(db);
  }

  async getUsers(request, reply) {
    try {
      const { page, limit, search, sortBy, sortOrder } = request.query;
      const result = await this.service.getPaginatedUsers({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        search,
        sortBy: sortBy || 'created_at',
        sortOrder: sortOrder || 'asc',
      });
      return reply.send(result);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'Failed to fetch users',
        message: error.message,
      });
    }
  }

  // ... other controller methods
}

module.exports = UserController;
