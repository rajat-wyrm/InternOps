const { findBlocksByTestId, stripTags, getAttr } = require('./mini-html');
const { parseCount } = require('./parse-count');

const DOMAIN = 'twitter.com';

/**
 * Parse a saved X/Twitter post page and extract whatever is visible
 * without auth. Never throws — on missing/unexpected markup it
 * returns null fields instead of failing the caller.
 *
 * No external HTML-parsing library is used on purpose (zero install
 * footprint) — see ./mini-html for the small regex-based helper this
 * relies on. It assumes reasonably well-formed markup, matching what
 * a saved page fetch would produce.
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

  let articles;
  try {
    articles = findBlocksByTestId(rawHtml, 'article', 'tweet');
  } catch {
    return result;
  }

  if (!articles || articles.length === 0) {
    return result;
  }

  // The first tweet article on the page is the main post; any
  // subsequent ones are visible public replies.
  const [mainArticle, ...replyArticles] = articles;

  const mainTextBlock = findBlocksByTestId(mainArticle.inner, 'div', 'tweetText')[0];
  const mainText = mainTextBlock ? stripTags(mainTextBlock.inner) : '';
  result.text = mainText || null;

  const likeBlock = findBlocksByTestId(mainArticle.inner, 'div', 'like')[0];
  const replyBlock = findBlocksByTestId(mainArticle.inner, 'div', 'reply')[0];
  const repostBlock = findBlocksByTestId(mainArticle.inner, 'div', 'retweet')[0];

  const likeLabel = likeBlock && getAttr(likeBlock.openTag, 'aria-label');
  const replyLabel = replyBlock && getAttr(replyBlock.openTag, 'aria-label');
  const repostLabel = repostBlock && getAttr(repostBlock.openTag, 'aria-label');

  result.visibleSignals.likeCount = parseCount(likeLabel && likeLabel.split(' ')[0]);
  result.visibleSignals.replyCount = parseCount(replyLabel && replyLabel.split(' ')[0]);
  result.visibleSignals.repostCount = parseCount(repostLabel && repostLabel.split(' ')[0]);

  for (const reply of replyArticles) {
    const replyTextBlock = findBlocksByTestId(reply.inner, 'div', 'tweetText')[0];
    const replyText = replyTextBlock ? stripTags(replyTextBlock.inner) : '';
    if (replyText) {
      result.visibleSignals.comments.push(replyText);
    }
  }

  return result;
}

module.exports = { domain: DOMAIN, parse };
