const repository = require('./repository');

async function getDashboard(filters) {
  return repository.getDashboard(filters);
}

module.exports = { getDashboard };
