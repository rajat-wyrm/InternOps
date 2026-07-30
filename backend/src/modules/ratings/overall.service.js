const repository = require('./repository');

async function generateOverallSummary(userId) {
  const history = await repository.getRatingHistory(userId);

  return {
    overallScore: 0,
    narrative: 'Overall summary will be generated here.',
    trend: 'stable',
    history,
  };
}

module.exports = {
  generateOverallSummary,
};