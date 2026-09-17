function removeMarkdownCodeFences(value) {
  if (typeof value !== 'string') return '';

  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function safeParseJSON(value) {
  const cleaned = removeMarkdownCodeFences(value);

  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function clean_and_parse_json(value) {
  return (
    safeParseJSON(value) || {
      score: null,
      reason: 'Parsing failed',
    }
  );
}

module.exports = {
  clean_and_parse_json,
  removeMarkdownCodeFences,
  safeParseJSON,
};
