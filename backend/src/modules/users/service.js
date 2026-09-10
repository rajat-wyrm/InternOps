// backend/src/modules/users/service.js

const UserRepository = require('./repository');

class UserService {
  constructor(db) {
    this.repository = new UserRepository(db);
  }

  async getPaginatedUsers(filters) {
    return this.repository.findPaginated(filters);
  }

  // ... other service methods
}

module.exports = UserService;
