// Basic input sanitization for common injection patterns
const sanitizeHtml = require('sanitize-html');

// Fields that must never be mutated, regardless of any allowlist —
// auth/token logic depends on exact, byte-for-byte string matching
// (bcrypt comparison, token validation). Sanitizing these would
// silently break login for any user whose password/token contains
// characters treated specially by sanitize-html.
const SENSITIVE_FIELDS = new Set([
  'password',
  'oldPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'resetToken',
  'refreshToken',
  '_csrf',
]);

function sanitizeInput(obj, excludedFields = []) {
  if (typeof obj !== 'object' || obj === null) return;

  for (const key of Object.keys(obj)) {
    const val = obj[key];

    if (SENSITIVE_FIELDS.has(key)) {
      continue; // never touch these, no matter what
    }

    if (typeof val === 'string') {
      if (!excludedFields.includes(key)) {
        obj[key] = sanitizeHtml(val, {
          allowedTags: [],
          allowedAttributes: {},
        });
      }
    } else if (val && typeof val === 'object') {
      sanitizeInput(val, excludedFields);
    }
  }
}

function sanitizationMiddleware(request, reply, done) {
  // Previously an allowlist (SAFE_FIELDS) — meant any field NOT in this
  // list (email, bio, etc.) was never sanitized at all. Now empty, so
  // every field is sanitized by default except SENSITIVE_FIELDS above.
  const EXCLUDED_FIELDS = [];

  if (request.body) {
    sanitizeInput(request.body, EXCLUDED_FIELDS);
  }

  if (request.query) {
    sanitizeInput(request.query, EXCLUDED_FIELDS);
  }

  if (request.params) {
    sanitizeInput(request.params, EXCLUDED_FIELDS);
  }

  done();
}

module.exports = { sanitizeInput, sanitizationMiddleware };
