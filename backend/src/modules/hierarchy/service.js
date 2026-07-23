const repo = require('./repository');

async function getFullTeam(managerId) {
  return repo.getFullTeam(managerId, { page: 1, limit: 10000 });
}

module.exports = {
  getFullTeam,
};
