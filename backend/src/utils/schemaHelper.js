const { zodToJsonSchema } = require('zod-to-json-schema');

function toSchema(zodObj) {
  const raw = zodToJsonSchema(zodObj, { target: 'openApi3' });
  return raw.definitions?.default ?? raw;
}

module.exports = { toSchema };
