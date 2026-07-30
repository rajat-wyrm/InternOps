// Basic input sanitization for common injection patterns
const sanitizeHtml = require('sanitize-html');

const ENTITY_DECODE_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&#x2F;': '/',
  '&#x60;': '`',
  '&#x3D;': '=',
};

const ENTITY_PATTERN = /&(?:amp|lt|gt|quot|#39|#x27|#x2F|#x60|#x3D);/g;

function decodeEntities(str) {
  return str.replace(
    ENTITY_PATTERN,
    (match) => ENTITY_DECODE_MAP[match] || match
  );
}

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

const SAFE_FIELDS = new Set([
  'name',
  'description',
  'message',
  'title',
  'content',
  'meeting_url',
  'meetingUrl',
]);

function isPlainObject(val) {
  return Object.prototype.toString.call(val) === '[object Object]';
}

function sanitizeString(val, isSafeField) {
  if (isSafeField) {
    return sanitizeHtml(val, {
      allowedTags: [],
      allowedAttributes: {},
    });
  }
  return decodeEntities(
    sanitizeHtml(val, {
      allowedTags: [],
      allowedAttributes: {},
    })
  );
}

function sanitizeInput(obj, depth = 0) {
  // Prevent stack overflow DoS attacks
  if (depth > 10 || !obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const val = obj[i];
      if (typeof val === 'string') {
        obj[i] = sanitizeString(val, false);
      } else if (isPlainObject(val) || Array.isArray(val)) {
        sanitizeInput(val, depth + 1);
      }
    }
    return;
  }

  if (!isPlainObject(obj)) return;

  for (const key of Object.keys(obj)) {
    if (SENSITIVE_FIELDS.has(key)) {
      continue;
    }

    const val = obj[key];

    if (typeof val === 'string') {
      obj[key] = sanitizeString(val, SAFE_FIELDS.has(key));
    } else if (isPlainObject(val) || Array.isArray(val)) {
      sanitizeInput(val, depth + 1);
    }
  }
}

function sanitizationMiddleware(request, reply, done) {
  if (request.body) {
    sanitizeInput(request.body);
  }

  if (request.query) {
    sanitizeInput(request.query);
  }

  if (request.params) {
    sanitizeInput(request.params);
  }

  done();
}

module.exports = { sanitizeInput, sanitizationMiddleware };
