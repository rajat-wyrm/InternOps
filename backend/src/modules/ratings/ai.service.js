const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config');
const metrics = require('../../utils/metrics');
const { clean_and_parse_json } = require('../../utils/promptCleaner');

let ratingsPrompt;
try {
  ratingsPrompt = require('../../../ai-service/app/prompts/ratings');
} catch (err) {
  const isModuleMissing = err && err.code === 'MODULE_NOT_FOUND';
  if (isModuleMissing || process.env.NODE_ENV === 'test') {
    ratingsPrompt = {
      RATINGS_SYSTEM_PROMPT: 'Stub system prompt',
      RATINGS_FEW_SHOT_EXAMPLE: { score: 5, feedback: 'Stub feedback' },
    };
    console.warn('ai-service prompts not found — using test stub fallback');
  } else {
    throw err;
  }
}

const genAI = new GoogleGenerativeAI(config.ai.geminiKey);

const MAX_FEEDBACK_WORDS = 15;
const MIN_FEEDBACK_WORDS = 10;

function safeSandbox(value, maxLen = 200) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return String(value).slice(0, maxLen);
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function buildUserSnapshot(data) {
  const user = data?.user || {};
  const metricsData = data?.metrics || {};
  return {
    id: safeSandbox(user.id),
    role: safeSandbox(user.role, 32),
    attendancePercentage: Number(metricsData.attendancePercentage) || 0,
    verificationRate: Number(metricsData.verificationRate) || 0,
    averageRating: Number(metricsData.averageRating) || 0,
    ratingTrend: safeSandbox(metricsData.ratingTrend, 32),
    ratingsCount: Array.isArray(data?.ratings) ? data.ratings.length : 0,
    tasksSubmitted: Number(data?.tasks?.submitted) || 0,
    tasksVerified: Number(data?.tasks?.verified) || 0,
  };
}

async function generateRatingSuggestion(data) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0 },
  });

  const snapshot = buildUserSnapshot(data);

  const prompt = `
  ${ratingsPrompt.RATINGS_SYSTEM_PROMPT}

  Example:
  ${JSON.stringify(ratingsPrompt.RATINGS_FEW_SHOT_EXAMPLE)}

  BEGIN DATA
  ${JSON.stringify(snapshot)}
  END DATA
  `.trim();

  const start = Date.now();
  let result;

  try {
    result = await model.generateContent(prompt);

    const duration = Date.now() - start;
    if (typeof metrics.recordLatency === 'function') {
      metrics.recordLatency('ai_service', duration);
    }

    if (
      result?.response?.usageMetadata?.totalTokenCount &&
      typeof metrics.recordTokenUsage === 'function'
    ) {
      metrics.recordTokenUsage(result.response.usageMetadata.totalTokenCount);
    }
  } catch (err) {
    if (typeof metrics.recordError === 'function') {
      metrics.recordError('ai_service');
    }
    throw err;
  }

  const raw = result.response.text();
  const parsed = clean_and_parse_json(raw);

  const score = Number(parsed.score);
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    return {
      source: 'ai',
      suggestedScore: null,
      feedback: 'Invalid score from AI response',
    };
  }

  let feedback = String(parsed.feedback || '').trim();
  if (!feedback) {
    return {
      source: 'ai',
      suggestedScore: score,
      feedback: 'Missing feedback in AI response',
    };
  }

  const wordCount = feedback.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_FEEDBACK_WORDS || wordCount > MAX_FEEDBACK_WORDS) {
    feedback = feedback.split(/\s+/).slice(0, MAX_FEEDBACK_WORDS).join(' ');
  }

  return {
    source: 'ai',
    suggestedScore: score,
    feedback,
  };
}

module.exports = { generateRatingSuggestion };
