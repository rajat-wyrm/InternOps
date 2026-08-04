const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config');
const metrics = require('../../utils/metrics');
const { clean_and_parse_json } = require('../../utils/promptCleaner');

let claimPrompt;

try {
  claimPrompt = require('../../../ai-service/app/prompts/claim_verification');
} catch (err) {
  const isModuleMissing = err && err.code === 'MODULE_NOT_FOUND';

  if (isModuleMissing || process.env.NODE_ENV === 'test') {
    claimPrompt = {
      CLAIM_VERIFICATION_SYSTEM_PROMPT: 'Stub system prompt',
      CLAIM_VERIFICATION_FEW_SHOT_EXAMPLE: {
        results: [],
      },
    };

    console.warn(
      'claim verification prompts not found — using test stub fallback'
    );
  } else {
    throw err;
  }
}

const genAI = new GoogleGenerativeAI(config.ai.geminiKey);

async function verifyClaim({ content, claimedActions }) {
  if (!content || !content.trim()) {
    return claimedActions.map((action) => ({
      action,
      confidence: 'unverifiable',
      supports: false,
      notes: 'No content available to verify.',
    }));
  }
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
    },
  });
  const prompt = `
${claimPrompt.CLAIM_VERIFICATION_SYSTEM_PROMPT}

Example:
${JSON.stringify(claimPrompt.CLAIM_VERIFICATION_FEW_SHOT_EXAMPLE)}

BEGIN CONTENT
${content}
END CONTENT

Claimed Actions:
${JSON.stringify(claimedActions)}
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

  if (!parsed.results || !Array.isArray(parsed.results)) {
    return claimedActions.map((action) => ({
      action,
      confidence: 'unverifiable',
      supports: false,
      notes: 'Unable to parse AI response.',
    }));
  }

  return parsed.results;
}

module.exports = {
  verifyClaim,
};
