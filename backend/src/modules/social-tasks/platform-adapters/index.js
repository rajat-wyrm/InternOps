/**
 * Get the platform adapter for a given domain/hostname.
 *
 * @param {string} hostname - The hostname/domain of the URL.
 * @returns {{
 *   domain: string,
 *   parse: (rawHtml: string) => { text: string, visibleSignals: object }
 * }} The platform adapter.
 */
function getAdapterForDomain(hostname) {
  throw new Error('Not implemented');
}

module.exports = {
  getAdapterForDomain,
};
