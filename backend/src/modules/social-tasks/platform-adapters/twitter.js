function cleanText(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parse(rawHtml) {
  if (typeof rawHtml !== 'string' || !rawHtml.trim()) {
    return null;
  }

  const textMatch = rawHtml.match(
    /<article[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?<\/article>/i
  );

  const likeMatch = rawHtml.match(/([\d,.]+)\s*(?:Likes|likes)/);
  const shareMatch = rawHtml.match(
    /([\d,.]+)\s*(?:Reposts|reposts|Retweets|retweets)/
  );

  return {
    text: textMatch ? cleanText(textMatch[1]) : null,
    visibleSignals: {
      likes: likeMatch ? likeMatch[1] : null,
      shares: shareMatch ? shareMatch[1] : null,
    },
  };
}

module.exports = {
  domain: 'twitter.com',
  parse,
};
