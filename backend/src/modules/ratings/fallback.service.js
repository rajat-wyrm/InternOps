function attendanceScore(attendancePercentage) {
  if (attendancePercentage >= 95) return 5;
  if (attendancePercentage >= 90) return 4.5;
  if (attendancePercentage >= 80) return 4;
  if (attendancePercentage >= 70) return 3;
  if (attendancePercentage >= 60) return 2;

  return 1;
}

function taskScore(verificationRate) {
  if (verificationRate >= 90) return 5;
  if (verificationRate >= 80) return 4;
  if (verificationRate >= 70) return 3;
  if (verificationRate >= 60) return 2;

  return 1;
}

function buildReasoning(attendance, tasks, history) {
  const parts = [];
  if (attendance >= 4) parts.push('strong attendance');
  else if (attendance <= 2) parts.push('weak attendance');
  else parts.push('average attendance');

  if (tasks >= 4) parts.push('reliable task verification');
  else if (tasks <= 2) parts.push('low verification rate');
  else parts.push('moderate task verification');

  if (history) {
    parts.push(`prior average ${history}`);
  }
  return `Fallback estimate based on ${parts.join(', ')}.`;
}

function calculateFallbackRating(metrics) {
  const attendance = attendanceScore(metrics.attendancePercentage);

  const tasks = taskScore(metrics.verificationRate);

  const history = metrics.averageRating || 0;

  const finalScore = attendance * 0.4 + tasks * 0.4 + history * 0.2;

  return {
    source: 'fallback',

    suggestedScore: Number(finalScore.toFixed(2)),

    reasoning: buildReasoning(attendance, tasks, history),

    breakdown: {
      attendance,
      tasks,
      history,
    },
  };
}

module.exports = {
  calculateFallbackRating,
};
