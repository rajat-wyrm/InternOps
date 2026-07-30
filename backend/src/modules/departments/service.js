const repo = require('./repository');

async function getDepartmentTeams(departmentId) {
  return repo.getDepartmentTeams(departmentId);
}

module.exports = {
  getDepartmentTeams,
};
