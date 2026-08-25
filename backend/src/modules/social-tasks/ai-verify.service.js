const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;

function getModel() {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  return genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
  });
}

/**
 * Verify an intern's claimed actions against crawled proof content.
 *
 * @param {object} params
 * @param {string} params.content - Crawled proof content.
 * @param {object} params.claimedActions - Claimed actions.
 * @returns {Promise<{
 *   confidence: 'high' | 'medium' | 'low' | 'unverifiable',
 *   supports: boolean | null,
 *   notes: string
 * }>}
 */
async function verifyClaim({ content, claimedActions }) {
  if (typeof content !== 'string' || !content.trim()) {
    return {
      confidence: 'unverifiable',
      supports: null,
      notes: 'No crawled proof content was available for verification.',
    };
  }

  if (!claimedActions || typeof claimedActions !== 'object') {
    return {
      confidence: 'unverifiable',
      supports: null,
      notes: 'No claimed actions were provided for verification.',
    };
  }

  const prompt = `
You are verifying an intern's claimed social-media actions against publicly
visible content extracted from a proof URL.

Do not assume an action happened merely because the intern claims it.
Use only the supplied crawled content.

Claimed actions:
${JSON.stringify(claimedActions, null, 2)}

Crawled content:
${content}

Determine whether the crawled content supports the claimed actions.

Return ONLY valid JSON in exactly this structure:

{
  "confidence": "high" | "medium" | "low" | "unverifiable",
  "supports": true | false | null,
  "notes": "brief explanation"
}

Rules:
- "high": clear visible evidence supports the claim.
- "medium": some evidence supports the claim but it is incomplete.
- "low": evidence is weak or contradictory.
- "unverifiable": the supplied content does not provide enough evidence.
- Use supports=true only when the evidence supports the claimed actions.
- Use supports=false when the evidence contradicts the claimed actions.
- Use supports=null when the claim cannot be verified.
- Do not invent usernames, actions, comments, likes, reposts, or other evidence.
`;

  try {
    const model = getModel();
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    const cleanedText = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleanedText);

    const validConfidence = ['high', 'medium', 'low', 'unverifiable'].includes(
      parsed.confidence
    );

    const validSupports =
      parsed.supports === true ||
      parsed.supports === false ||
      parsed.supports === null;

    if (!validConfidence || !validSupports) {
      return {
        confidence: 'unverifiable',
        supports: null,
        notes: 'AI returned an invalid verification result.',
      };
    }

    return {
      confidence: parsed.confidence,
      supports: parsed.supports,
      notes:
        typeof parsed.notes === 'string'
          ? parsed.notes
          : 'AI verification completed without additional notes.',
    };
  } catch (error) {
    console.error('AI verification error:', error);

    return {
      confidence: 'unverifiable',
      supports: null,
      notes: 'AI verification could not be completed.',
    };
  }
}

module.exports = {
  verifyClaim,
};
