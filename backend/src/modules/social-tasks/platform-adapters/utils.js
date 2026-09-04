/**
 * Shared helpers for platform content adapters.
 *
 * Kept deliberately tiny and dependency-free (beyond cheerio, which callers
 * already use for DOM traversal) so each adapter stays a plain
 * `parse(rawHtml)` function with zero shared state, per #1640.
 */

/**
 * Collapse whitespace left behind once tags are stripped (line breaks,
 * repeated spaces from nested inline elements, etc.) and trim the ends.
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract a visible engagement count (likes, reposts, reactions, ...) from
 * a string and normalize it to a plain digit string, e.g.:
 *   "125"        -> "125"
 *   "125 Likes"  -> "125"
 *   "1,234"      -> "1234"
 *   "1.2K"       -> "1200"
 *
 * Returns null when no parseable count is present, so callers can pass
 * through missing/hidden counts without special-casing them.
 *
 * @param {string | undefined | null} raw
 * @returns {string | null}
 */
function parseCount(raw) {
  if (typeof raw !== 'string') {
    return null;
  }

  const match = raw.trim().match(/([\d,]+(?:\.\d+)?)\s*([KkMm])?/);
  if (!match) {
    return null;
  }

  const numeric = parseFloat(match[1].replace(/,/g, ''));
  if (Number.isNaN(numeric)) {
    return null;
  }

  const suffix = match[2] ? match[2].toUpperCase() : '';
  const multiplier = suffix === 'K' ? 1000 : suffix === 'M' ? 1000000 : 1;

  return String(Math.round(numeric * multiplier));
}

module.exports = { normalizeText, parseCount };
