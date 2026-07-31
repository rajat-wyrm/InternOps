const repository = require('./repository');

async function generateOverallSummary(userId) {
  try {
    const history = await repository.getRatingHistory(userId);

    if (!history || history.length === 0) {
      return {
        overallScore: 0,
        narrative: 'No rating history available.',
        trend: 'stable',
        history: [],
      };
    }

    // Calculate average score
    const totalScore = history.reduce((sum, rating) => sum + rating.score, 0);

    const overallScore = Number((totalScore / history.length).toFixed(2));

    // Calculate trend using recent ratings
    let trend = 'stable';

    if (history.length >= 2) {
      const latestScore = history[history.length - 1].score;
      const previousScore = history[history.length - 2].score;

      if (latestScore > previousScore) {
        trend = 'improving';
      } else if (latestScore < previousScore) {
        trend = 'declining';
      }
    }

    return {
      overallScore,
      narrative: `Overall performance score is ${overallScore}. Trend is ${trend}.`,
      trend,
      history,
    };
  } catch (error) {
    throw new Error(`Failed to generate overall summary: ${error.message}`);
  }
}

module.exports = {
  generateOverallSummary,
};
