// Basic input sanitization for common injection patterns
const sanitizeHtml = require('sanitize-html');
function sanitizeInput(obj, allowedFields = []) {
  if (typeof obj !== 'object' || obj === null) return;

  for (const key of Object.keys(obj)) {
    const val = obj[key];

    if (typeof val === 'string') {
      if (allowedFields.length === 0 || allowedFields.includes(key)) {
        obj[key] = sanitizeHtml(val, {
          allowedTags: [],
          allowedAttributes: {},
        });
      }
    } else if (val && typeof val === 'object') {
      sanitizeInput(val, allowedFields);
    }
  }
}

function sanitizationMiddleware(request, reply, done) {
  const SAFE_FIELDS = ['name', 'description', 'message', 'title', 'content'];

  if (request.body) {
    sanitizeInput(request.body, SAFE_FIELDS);
  }

  if (request.query) {
    sanitizeInput(request.query, SAFE_FIELDS);
  }

  if (request.params) {
    sanitizeInput(request.params, SAFE_FIELDS);
  }

  done();
}

module.exports = { sanitizeInput, sanitizationMiddleware };
