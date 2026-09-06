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
  throw new Error('Not implemented');
}

module.exports = {
  verifyClaim,
};
