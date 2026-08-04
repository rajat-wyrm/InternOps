const cheerio = require('cheerio');
const { parseCount } = require('./parse-count');

const DOMAIN = 'twitter.com';

/**
 * Parse a saved X/Twitter post page and extract whatever is visible
 * without auth. Never throws — on missing/unexpected markup it
 * returns null fields instead of failing the caller.
 *
 * @param {string} rawHtml
 * @returns {{ text: string | null, visibleSignals: {
 *   likeCount: number | null,
 *   replyCount: number | null,
 *   repostCount: number | null,
 *   comments: string[]
 * } }}
 */
function parse(rawHtml) {
  const result = {
    text: null,
    visibleSignals: {
      likeCount: null,
      replyCount: null,
      repostCount: null,
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

  const articles = $('article[data-testid="tweet"]');
  if (articles.length === 0) {
    return result;
  }

  // The first tweet article on the page is the main post; any
  // subsequent ones (marked data-reply) are visible public replies.
  const mainArticle = articles.first();
  const mainText = mainArticle.find('[data-testid="tweetText"]').first().text().trim();
  result.text = mainText || null;

  const likeLabel = mainArticle.find('[data-testid="like"]').attr('aria-label');
  const replyLabel = mainArticle.find('[data-testid="reply"]').attr('aria-label');
  const repostLabel = mainArticle.find('[data-testid="retweet"]').attr('aria-label');

  result.visibleSignals.likeCount = parseCount(likeLabel && likeLabel.split(' ')[0]);
  result.visibleSignals.replyCount = parseCount(replyLabel && replyLabel.split(' ')[0]);
  result.visibleSignals.repostCount = parseCount(repostLabel && repostLabel.split(' ')[0]);

  articles.slice(1).each((_, el) => {
    const replyText = $(el).find('[data-testid="tweetText"]').first().text().trim();
    if (replyText) {
      result.visibleSignals.comments.push(replyText);
    }
  });

  return result;
}

module.exports = { domain: DOMAIN, parse };
