const { findBlocksByClass, stripTags } = require('./mini-html');
const { parseCount } = require('./parse-count');

const DOMAIN = 'linkedin.com';

/**
 * Parse a saved LinkedIn post page and extract whatever is visible
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

  let posts;
  try {
    posts = findBlocksByClass(rawHtml, 'div', 'feed-shared-update-v2');
  } catch {
    return result;
  }

  if (!posts || posts.length === 0) {
    return result;
  }

  const post = posts[0].inner;

  const textBlock = findBlocksByClass(post, 'span', 'break-words')[0];
  const postText = textBlock ? stripTags(textBlock.inner) : '';
  result.text = postText || null;

  const reactionBlock = findBlocksByClass(post, 'span', 'social-details-social-counts__reactions-count')[0];
  result.visibleSignals.reactionCount = parseCount(reactionBlock ? stripTags(reactionBlock.inner) : null);

  const commentBlock = findBlocksByClass(post, 'li', 'social-details-social-counts__comments')[0];
  const commentText = commentBlock ? stripTags(commentBlock.inner) : '';
  result.visibleSignals.commentCount = parseCount(commentText ? commentText.split(' ')[0] : null);

  const shareBlock = findBlocksByClass(post, 'li', 'social-details-social-counts__shares')[0];
  const shareText = shareBlock ? stripTags(shareBlock.inner) : '';
  result.visibleSignals.shareCount = parseCount(shareText ? shareText.split(' ')[0] : null);

  const commentBodyBlocks = findBlocksByClass(post, 'span', 'comments-comment-item__main-content');
  for (const block of commentBodyBlocks) {
    const commentBody = stripTags(block.inner);
    if (commentBody) {
      result.visibleSignals.comments.push(commentBody);
    }
  }

  return result;
}

module.exports = { domain: DOMAIN, parse };
