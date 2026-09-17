const repo = require('./repository');

async function getLatestAssessment(userId) {
  return repo.getLatestAssessment(userId);
}

async function createAssessment(data) {
  return repo.createAssessment(data);
}

module.exports = {
  getLatestAssessment,
  createAssessment,
};
