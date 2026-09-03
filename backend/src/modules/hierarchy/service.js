const repo = require('./repository');

async function getFullTeam(managerId, { page = 1, limit = 10 } = {}) {
  return repo.getFullTeam(managerId, { page, limit });
}

module.exports = {
  getFullTeam,
};
