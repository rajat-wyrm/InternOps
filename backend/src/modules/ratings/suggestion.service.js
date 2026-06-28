const repo = require('./suggestion.repository');
const fallback = require('./fallback.service');
const aiService = require('./ai.service');

function calculateAttendancePercentage(attendance) {
  const totalDays = Number(attendance.total_days || 0);
  const presentDays = Number(attendance.present_days || 0);
  const halfDays = Number(attendance.half_days || 0);

  if (totalDays === 0) {
    return 0;
  }

  return Number(
    (((presentDays + halfDays * 0.5) / totalDays) * 100).toFixed(2)
  );
}

function calculateVerificationRate(tasks) {
  const submitted = Number(tasks.submitted || 0);
  const verified = Number(tasks.verified || 0);

  if (submitted === 0) {
    return 0;
  }

  return Number(((verified / submitted) * 100).toFixed(2));
}

function calculateAverageRating(ratings) {
  if (!ratings.length) {
    return 0;
  }

  const total = ratings.reduce((sum, rating) => sum + Number(rating.score), 0);

  return Number((total / ratings.length).toFixed(2));
}

function calculateRatingTrend(ratings) {
  if (ratings.length < 2) {
    return 'INSUFFICIENT_DATA';
  }

  const newest = Number(ratings[0].score);

  const oldest = Number(ratings[ratings.length - 1].score);

  if (newest > oldest) {
    return 'IMPROVING';
  }

  if (newest < oldest) {
    return 'DECLINING';
  }

  return 'STABLE';
}

function isNewUser(createdAt) {
  const joinedDate = new Date(createdAt);

  const today = new Date();

  const diffDays = Math.floor((today - joinedDate) / (1000 * 60 * 60 * 24));

  return diffDays <= 7;
}

async function getSuggestionData(userId) {
  const user = await repo.getUser(userId);

  if (!user) {
    throw new Error('User not found');
  }

  const allowedRoles = ['TL', 'CAPTAIN', 'INTERN'];

  if (!allowedRoles.includes(user.role)) {
    throw new Error('Unsupported role for rating suggestion');
  }

  const userIsNew = isNewUser(user.created_at);
  if (userIsNew) {
    return {
      user: {
        id: user.id,
        full_name: user.full_name,
        role: user.role,
      },

      isNewUser: true,

      recommendation: {
        source: 'new_user',
        suggestedScore: null,
        reasoning: 'New user joined recently',
      },
    };
  }

  const attendance = await repo.getAttendanceSummary(userId);

  const tasks = await repo.getTaskSummary(userId);

  const ratings = await repo.getRatingHistory(userId);

  const metrics = {
    attendancePercentage: calculateAttendancePercentage(attendance),

    verificationRate: calculateVerificationRate(tasks),

    averageRating: calculateAverageRating(ratings),

    ratingTrend: calculateRatingTrend(ratings),
  };

  let recommendation;

  try {
    recommendation = await aiService.generateRatingSuggestion({
      user,
      metrics,
      attendance,
      tasks,
      ratings,
    });
  } catch (error) {
    console.error('AI rating generation failed:', error.message);

    recommendation = fallback.calculateFallbackRating(metrics);
  }

  return {
    user: {
      id: user.id,
      full_name: user.full_name,
      role: user.role,
    },

    isNewUser: false,

    recommendation,
  };
}

module.exports = {
  getSuggestionData,
};
