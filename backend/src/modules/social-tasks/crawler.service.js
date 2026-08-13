/**
 * Crawler service contract.
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
