const cheerio = require('cheerio');
const { normalizeText, parseCount } = require('./utils');

// Selectors are tried in order, most-specific first. X/Twitter's markup is
// a moving target (class names are generated, but `data-testid` hooks have
// been the most stable anchor historically), so we fall back to looser
// structural selectors rather than depending on one exact shape.
//
// NOTE: these were built against publicly-documented structural patterns
// (data-testid hooks), not a live-fetched page — this repo intentionally
// never hits real platforms in tests (see #1640 AC). Before this adapter is
// pointed at real traffic, swap in a couple of verified live snapshots as
// fixtures and confirm the selectors still line up.
const POST_TEXT_SELECTORS = [
  '[data-testid="tweetText"]',
  'article [lang]',
  'article p',
];
const LIKE_SELECTORS = ['[data-testid="like"]', '[aria-label*="Like" i]'];
const REPOST_SELECTORS = [
  '[data-testid="retweet"]',
  '[aria-label*="Repost" i]',
  '[aria-label*="Retweet" i]',
];

// Replies/quote-tweets reuse the exact same tweet markup as the main post,
// so anything under this wrapper is treated as comment content rather than
// the post itself.
const REPLY_CONTAINER_SELECTOR = '[data-testid="reply-thread"]';

function isOwnPost($el, $) {
  return $el.closest(REPLY_CONTAINER_SELECTOR).length === 0;
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

  $(`${REPLY_CONTAINER_SELECTOR} [data-testid="tweetText"]`).each((_, node) => {
    const text = normalizeText($(node).text());
    if (text) {
      comments.push(text);
    }
  });

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
 * Parse a saved X/Twitter post page (or fragment) into its publicly visible
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
  domain: 'twitter.com',
  parse,
};
