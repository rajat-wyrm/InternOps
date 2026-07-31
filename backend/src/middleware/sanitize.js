// Basic input sanitization for common injection patterns
const sanitizeHtml = require('sanitize-html');

const EXCLUDED_FIELDS = new Set([
  'password',
  'oldpassword',
  'newpassword',
  'confirmpassword',
  'token',
  'resettoken',
  'accesstoken',
  'refreshtoken',
  'verificationtoken',
  'apikey',
  'clientsecret',
  'email',
  'recipient_email',
  'avatar_url',
  'thumbnail_url',
  'qr_code_url',
  'pdf_path',
  'url',
  'link',
  'actionurl',
  'redirecturi',
  'redirect_uri',
  '_csrf',
]);

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

const EXCLUDED_TERMS = [
  'password',
  'token',
  'secret',
  'key',
  'signature',
  'url',
  'uri',
  'path',
];

function isExcludedField(key) {
  if (typeof key !== 'string') return false;
  const lowerKey = key.toLowerCase();

  if (EXCLUDED_FIELDS.has(lowerKey)) {
    return true;
  }

  for (const term of EXCLUDED_TERMS) {
    if (lowerKey === term) {
      return true;
    }

    // Check for delimiter boundary (e.g. api_key, client-secret)
    if (lowerKey.endsWith('_' + term) || lowerKey.endsWith('-' + term)) {
      return true;
    }

    // Check for camelCase boundary (e.g. apiKey, clientSecret)
    const capitalizedTerm = term.charAt(0).toUpperCase() + term.slice(1);
    if (key.endsWith(capitalizedTerm)) {
      return true;
    }
  }

  return false;
}

function isPlainObject(val) {
  return Object.prototype.toString.call(val) === '[object Object]';
}

function sanitizeInput(obj, excludedFields = [], depth = 0) {
  // Prevent stack overflow DoS attacks
  if (depth > 10 || !obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const val = obj[i];
      if (typeof val === 'string') {
        obj[i] = sanitizeHtml(val, {
          allowedTags: [],
          allowedAttributes: {},
        });
      } else if (val && typeof val === 'object') {
        sanitizeInput(val, excludedFields, depth + 1);
      }
    }
    return;
  }

  if (!isPlainObject(obj)) return;

  for (const key of Object.keys(obj)) {
    if (
      SENSITIVE_FIELDS.has(key) ||
      isExcludedField(key) ||
      excludedFields.includes(key)
    ) {
      continue;
    }

    const val = obj[key];

    if (typeof val === 'string') {
      obj[key] = sanitizeHtml(val, {
        allowedTags: [],
        allowedAttributes: {},
      });
    } else if (val && typeof val === 'object') {
      sanitizeInput(val, excludedFields, depth + 1);
    }
  }
}

function sanitizationMiddleware(request, reply, done) {
  const SAFE_FIELDS = [
    'name',
    'description',
    'message',
    'title',
    'content',
    'meeting_url',
    'meetingUrl',
  ];
  // Previously an allowlist (SAFE_FIELDS) — meant any field NOT in this
  // list (email, bio, etc.) was never sanitized at all. Now empty, so
  // every field is sanitized by default except SENSITIVE_FIELDS and other exclusions.
  const EXCLUDED_FIELDS_PARAM = [];

  if (request.body) {
    sanitizeInput(request.body, EXCLUDED_FIELDS_PARAM);
  }

  if (request.query) {
    sanitizeInput(request.query, EXCLUDED_FIELDS_PARAM);
  }

  if (request.params) {
    sanitizeInput(request.params, EXCLUDED_FIELDS_PARAM);
  }

  done();
}

module.exports = { sanitizeInput, sanitizationMiddleware, isExcludedField };
