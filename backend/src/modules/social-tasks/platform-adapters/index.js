const twitterAdapter = require('./twitter');
const linkedinAdapter = require('./linkedin');

const adapters = {
  'twitter.com': twitterAdapter,
  'www.twitter.com': twitterAdapter,
  'x.com': twitterAdapter,
  'www.x.com': twitterAdapter,

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
 * } | null} The platform adapter.
 */
function getAdapterForDomain(hostname) {
  if (typeof hostname !== 'string') {
    return null;
  }

  const normalizedHostname = hostname.toLowerCase().trim();

  return adapters[normalizedHostname] || null;
}

module.exports = {
  getAdapterForDomain,
};
