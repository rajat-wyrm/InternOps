const twitterAdapter = require('./twitter');
const linkedinAdapter = require('./linkedin');

// Registered adapters, keyed by every hostname variant that should
// resolve to them (www./mobile subdomains, bare apex domain, etc.).
const ADAPTERS_BY_HOSTNAME = {
  'twitter.com': twitterAdapter,
  'www.twitter.com': twitterAdapter,
  'x.com': twitterAdapter,
  'www.x.com': twitterAdapter,
  'mobile.twitter.com': twitterAdapter,
  'linkedin.com': linkedinAdapter,
  'www.linkedin.com': linkedinAdapter,
};

/**
 * Get the platform adapter for a given domain/hostname.
 *
 * @param {string} hostname - The hostname/domain of the URL.
 * @returns {{
 *   domain: string,
 *   parse: (rawHtml: string) => { text: string, visibleSignals: object }
 * } | null} The platform adapter, or null if no adapter is
 * registered for this hostname.
 */
function getAdapterForDomain(hostname) {
  if (!hostname || typeof hostname !== 'string') {
    return null;
  }
  return ADAPTERS_BY_HOSTNAME[hostname.toLowerCase()] || null;
}

module.exports = {
  getAdapterForDomain,
};
