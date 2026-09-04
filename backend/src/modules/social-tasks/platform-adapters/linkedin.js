const cheerio = require('cheerio');
const { normalizeText, parseCount } = require('./utils');

// Selectors are tried in order, most-specific first. LinkedIn's generated
// class names churn often, so `data-*` hooks and ARIA labels are preferred
// as the more stable anchors, with a generic article/p fallback last.
//
// NOTE: these were built against publicly-documented structural patterns,
// not a live-fetched page — this repo intentionally never hits real
// platforms in tests (see #1640 AC). Before this adapter is pointed at real
// traffic, swap in a couple of verified live snapshots as fixtures and
// confirm the selectors still line up.
const POST_TEXT_SELECTORS = [
  '[data-testid="post-text"]',
  'article [lang]',
  'article p',
];
const LIKE_SELECTORS = [
  '[data-testid="reactions-count"]',
  '[aria-label*="reaction" i]',
];
const REPOST_SELECTORS = [
  '[data-testid="reposts-count"]',
  '[aria-label*="repost" i]',
];

// Comments render as a separate list beneath the post itself.
const COMMENTS_CONTAINER_SELECTOR = '[data-testid="comments-list"]';

function isOwnPost($el, $) {
  return $el.closest(COMMENTS_CONTAINER_SELECTOR).length === 0;
}

function extractPostText($) {
  for (const selector of POST_TEXT_SELECTORS) {
    const el = $(selector)
      .filter((_, node) => isOwnPost($(node), $))
      .first();

    const text = el.length ? normalizeText(el.text()) : '';
    if (text) {
      return text;
    }
  }
  return null;
}

function extractComments($) {
  const comments = [];

  $(`${COMMENTS_CONTAINER_SELECTOR} [data-testid="comment-text"]`).each(
    (_, node) => {
      const text = normalizeText($(node).text());
      if (text) {
        comments.push(text);
      }
    }
  );

  return comments;
}

function extractCount($, selectors) {
  for (const selector of selectors) {
    const el = $(selector)
      .filter((_, node) => isOwnPost($(node), $))
      .first();

    if (!el.length) {
      continue;
    }

    const count = parseCount(el.text()) ?? parseCount(el.attr('aria-label'));
    if (count !== null) {
      return count;
    }
  }
  return null;
}

/**
 * Parse a saved LinkedIn post page (or fragment) into its publicly visible
 * content. Never throws — malformed input or markup we don't recognize just
 * yields fields set to null/empty rather than an exception, since the
 * crawler calling this may hand us a logged-out view, a deleted post, or
 * anything in between.
 *
 * @param {string} rawHtml
 * @returns {{
 *   text: string | null,
 *   comments: string[],
 *   visibleSignals: { likes: string | null, shares: string | null }
 * } | null}
 */
function parse(rawHtml) {
  if (typeof rawHtml !== 'string' || !rawHtml.trim()) {
    return null;
  }

  try {
    const $ = cheerio.load(rawHtml);

    return {
      text: extractPostText($),
      comments: extractComments($),
      visibleSignals: {
        likes: extractCount($, LIKE_SELECTORS),
        shares: extractCount($, REPOST_SELECTORS),
      },
    };
  } catch {
    return {
      text: null,
      comments: [],
      visibleSignals: { likes: null, shares: null },
    };
  }
}

module.exports = {
  domain: 'linkedin.com',
  parse,
};
