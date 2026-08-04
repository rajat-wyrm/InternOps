/**
 * Parse a visible engagement count into a number.
 *
 * Handles plain integers ("256"), comma-grouped integers ("1,234"),
 * and platform-style abbreviations ("1.2K", "3.4M", "2B"). Returns
 * null (never throws) when the input isn't a recognizable count, so
 * callers can treat a missing/garbled count as "not shown" rather
 * than crash the adapter.
 *
 * @param {string | null | undefined} raw
 * @returns {number | null}
 */
function parseCount(raw) {
  if (raw === null || raw === undefined) return null;

  const text = String(raw).trim();
  if (!text) return null;

  const match = text.match(/^([\d,]*\.?\d+)\s*([KkMmBb]?)$/);
  if (!match) return null;

  const numericPart = Number(match[1].replace(/,/g, ''));
  if (Number.isNaN(numericPart)) return null;

  const suffix = match[2].toUpperCase();
  const multiplier =
    suffix === 'K' ? 1_000 : suffix === 'M' ? 1_000_000 : suffix === 'B' ? 1_000_000_000 : 1;

  return Math.round(numericPart * multiplier);
}

module.exports = { parseCount };
