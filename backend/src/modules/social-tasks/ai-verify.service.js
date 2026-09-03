const { generateAIResponse } = require('../../services/aiProviderService');
const { safeParseJSON } = require('../../utils/promptCleaner');

function createUnverifiableResults(claimedActions, notes) {
  return (Array.isArray(claimedActions) ? claimedActions : []).map(
    (action) => ({
      action,
      confidence: 'unverifiable',
      supports: false,
      notes,
    })
  );
}

/**
 * AI verification service contract.
 *
 * @param {object} params
 * @param {string} params.content - The proof content crawled from the URL.
 * @param {object} params.claimedActions - The actions the intern claims to have done (e.g., did_comment, did_repost, did_share).
 * @returns {Promise<{
 *   confidence: 'high' | 'medium' | 'low' | 'unverifiable',
 *   supports: boolean | null,
 *   notes: string
 * }>} The AI claim verification result.
 */
async function verifyClaim({ content, claimedActions }) {
  if (!content || !String(content).trim()) {
    return createUnverifiableResults(
      claimedActions,
      'No content available to verify.'
    );
  }

  const prompt = `Verify whether the provided content supports each claimed social-media action.

Return ONLY a JSON object with a "results" array. Each result must include:
- "action"
- "confidence" (high, medium, low, or unverifiable)
- "supports" (boolean)
- "notes" (brief explanation)

BEGIN CONTENT
${String(content).slice(0, 12000)}
END CONTENT

Claimed actions: ${JSON.stringify(claimedActions || [])}`;

  try {
    const response = await generateAIResponse({
      userId: 'social-task-verification',
      messages: [{ role: 'user', content: prompt }],
    });

    if (response.fallback) {
      console.warn('[AI Verify] AI service fallback returned', response.error);
      return createUnverifiableResults(
        claimedActions,
        'AI verification service is currently unavailable.'
      );
    }

    const parsed = safeParseJSON(response.content);
    if (!Array.isArray(parsed?.results)) {
      console.warn('[AI Verify] Invalid AI verification response');
      return createUnverifiableResults(
        claimedActions,
        'Unable to parse AI verification response.'
      );
    }

    return parsed.results;
  } catch (error) {
    console.error('[AI Verify] Verification request failed', {
      message: error.message,
    });
    return createUnverifiableResults(
      claimedActions,
      'AI verification service is currently unavailable.'
    );
  }
}

module.exports = {
  verifyClaim,
};
