'use strict';

/**
 * A deliberately small, dependency-free HTML helper for the platform
 * adapters. It is NOT a general-purpose HTML parser — it assumes
 * reasonably well-formed markup (as saved fixture pages are) and only
 * implements exactly what the adapters need: finding an element by
 * data-testid/class and extracting its balanced inner content, reading
 * an attribute off the opening tag, and stripping tags down to text.
 */

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text) {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z0-9]+);/gi, (whole, code) => {
    if (code[0] === '#') {
      const codePoint =
        code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isNaN(codePoint) ? whole : String.fromCodePoint(codePoint);
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, code.toLowerCase())
      ? NAMED_ENTITIES[code.toLowerCase()]
      : whole;
  });
}

/**
 * Strip all tags from an HTML fragment and collapse whitespace,
 * returning plain visible text.
 * @param {string} html
 * @returns {string}
 */
function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the index just past the closing tag that balances an opening
 * tag of `tagName`, given a starting index right after that opening
 * tag. Correctly handles same-type tags nested inside (e.g. nested
 * <div>s), by tracking depth. Returns -1 if unbalanced/not found.
 */
function findBalancedCloseIndex(html, tagName, fromIndex) {
  const openRe = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  const closeRe = new RegExp(`</${tagName}>`, 'gi');
  let depth = 1;
  let pos = fromIndex;

  while (depth > 0) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    const openMatch = openRe.exec(html);
    const closeMatch = closeRe.exec(html);

    if (!closeMatch) return -1;

    if (openMatch && openMatch.index < closeMatch.index) {
      depth += 1;
      pos = openMatch.index + openMatch[0].length;
    } else {
      depth -= 1;
      pos = closeMatch.index + closeMatch[0].length;
      if (depth === 0) return closeMatch.index;
    }
  }
  return -1;
}

/**
 * Find every `<tagName ...>` element whose opening tag matches
 * `attrPattern`, returning each as { openTag, inner } where `inner`
 * is the balanced content between the opening and matching closing
 * tag. Order matches document order.
 */
function findBlocksByAttr(html, tagName, attrPattern) {
  const blocks = [];
  const openRe = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  let match;

  while ((match = openRe.exec(html)) !== null) {
    const openTag = match[0];
    if (!attrPattern.test(openTag)) continue;

    const contentStart = match.index + openTag.length;
    const closeIdx = findBalancedCloseIndex(html, tagName, contentStart);
    if (closeIdx === -1) continue;

    blocks.push({ openTag, inner: html.slice(contentStart, closeIdx) });
  }

  return blocks;
}

function findBlocksByTestId(html, tagName, testId) {
  return findBlocksByAttr(html, tagName, new RegExp(`data-testid=["']${testId}["']`));
}

function findBlocksByClass(html, tagName, className) {
  return findBlocksByAttr(html, tagName, new RegExp(`class=["'][^"']*\\b${className}\\b[^"']*["']`));
}

function getAttr(openTag, attrName) {
  const match = openTag.match(new RegExp(`${attrName}=["']([^"']*)["']`, 'i'));
  return match ? match[1] : null;
}

module.exports = {
  stripTags,
  findBlocksByAttr,
  findBlocksByTestId,
  findBlocksByClass,
  getAttr,
};
