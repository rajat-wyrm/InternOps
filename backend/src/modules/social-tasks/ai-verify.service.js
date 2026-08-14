/**
 * AI verification service contract.
 *
 * STATUS: Not implemented. Companion placeholder to `crawler.service.js` for
 * the deferred claim-verification feature (see issue #1710 for the full
 * investigation and rationale for keeping this as a documented stub instead
 * of finishing the integration). A working Gemini-based prototype of this
 * function existed at `Internship/ai-verify.service.js` but depended on a
 * broken `require()` of a Python prompt module and was never reachable from
 * any route, so it was removed as dead code rather than kept as a second
 * copy. If this feature is picked back up, port that prototype's approach
 * here, add a JS (not Python) version of the claim-verification prompt, and
 * call this from `proof-submissions/routes.js`.
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
