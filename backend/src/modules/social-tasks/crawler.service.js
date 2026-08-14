/**
 * Crawler service contract.
 *
 * STATUS: Not implemented. This is the sole remaining placeholder for the
 * "crawl a submitted proof URL, then AI-verify the intern's claimed actions
 * against the crawled content" feature. It was partially built in two
 * separate locations (see issue #1710) and never wired into the real
 * proof-submission flow, which currently uses
 * `proof-submissions/ai.service.js` for AI summaries instead.
 *
 * Related, still-unused scaffolding exists for this feature:
 * `backend/src/config/crawler-allowlist.js` (empty domain allowlist) and
 * the `proof_submissions.verification_result` column (migration 030).
 *
 * If this feature is picked back up: implement `fetchProofContent` with a
 * fetch + HTML-to-text extraction step, populate the allowlist, and wire
 * `ai-verify.service.js#verifyClaim` into `proof-submissions/routes.js`.
 *
 * @param {string} url - The URL to fetch proof content from.
 * @returns {Promise<{success: boolean, content?: string, error?: string}>} The proof content fetch result.
 */
async function fetchProofContent(url) {
  throw new Error('Not implemented');
}

module.exports = {
  fetchProofContent,
};
