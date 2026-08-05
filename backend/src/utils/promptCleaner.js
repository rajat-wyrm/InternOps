function clean_and_parse_json(raw) {
  if (!raw || typeof raw !== 'string') return {};

  // Strip markdown fences and whitespace
  let cleaned = raw.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    return {
      score: null,
      reason: 'Parsing failed: ' + err.message,
    };
  }
}

module.exports = { clean_and_parse_json };
