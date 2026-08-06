const cheerio = require('cheerio');
const { parseCount } = require('./parse-count');

const DOMAIN = 'linkedin.com';

/**
 * Collapse any run of whitespace (including newlines from
 * multi-line/indented HTML) into a single space and trim ends.
 * @param {string} str
 * @returns {string}
 */
function normalizeWhitespace(str) {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Parse a saved LinkedIn post page and extract whatever is visible
 * without auth. Never throws — on missing/unexpected markup it
 * returns null fields instead of failing the caller.
 *
 * @param {string} rawHtml
 * @returns {{ text: string | null, visibleSignals: {
 *   reactionCount: number | null,
 *   commentCount: number | null,
 *   shareCount: number | null,
 *   comments: string[]
 * } }}
 */
function parse(rawHtml) {
  const result = {
    text: null,
    visibleSignals: {
      reactionCount: null,
      commentCount: null,
      shareCount: null,
      comments: [],
    },
  };

  if (!rawHtml || typeof rawHtml !== 'string') {
    return result;
  }

  let $;
  try {
    $ = cheerio.load(rawHtml);
  } catch {
    return result;
  }

  const post = $('.feed-shared-update-v2').first();
  if (post.length === 0) {
    return result;
  }

  const postText = normalizeWhitespace(
    post.find('.feed-shared-update-v2__description .break-words').first().text()
  );
  result.text = postText || null;

  const reactionText = post
    .find('.social-details-social-counts__reactions-count')
    .first()
    .text()
    .trim();
  result.visibleSignals.reactionCount = parseCount(reactionText);

  const commentText = post
    .find('.social-details-social-counts__comments')
    .first()
    .text()
    .trim();
  result.visibleSignals.commentCount = parseCount(commentText.split(' ')[0]);

  const shareText = post
    .find('.social-details-social-counts__shares')
    .first()
    .text()
    .trim();
  result.visibleSignals.shareCount = parseCount(shareText.split(' ')[0]);

  post.find('.comments-comment-item__main-content').each((_, el) => {
    const commentBody = normalizeWhitespace($(el).text());
    if (commentBody) {
      result.visibleSignals.comments.push(commentBody);
    }
  });

  return result;
}

module.exports = { domain: DOMAIN, parse };
