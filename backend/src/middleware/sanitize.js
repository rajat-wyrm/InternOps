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
  'csrftoken',
  '_csrf',
  'apikey',
  'clientsecret',
  'secret',
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
]);

// Fields that must never be mutated, regardless of any allowlist —
// auth/token logic depends on exact, byte-for-byte string matching
// (bcrypt comparison, token validation). Sanitizing these would
// silently break login for any user whose password/token contains
// characters treated specially by sanitize-html.
const SENSITIVE_FIELDS = new Set([
  'password',
  'oldPassword',
  'oldpassword',
  'newPassword',
  'newpassword',
  'confirmPassword',
  'confirmpassword',
  'token',
  'resetToken',
  'resettoken',
  'refreshToken',
  'refreshtoken',
  'accessToken',
  'accesstoken',
  'verificationToken',
  'verificationtoken',
  'csrfToken',
  'csrftoken',
  '_csrf',
  'apiKey',
  'apikey',
  'clientSecret',
  'clientsecret',
  'secret',
]);

const SAFE_FIELDS = new Set([
  'name',
  'full_name',
  'title',
  'description',
  'content',
  'comment',
  'message',
  'bio',
  'feedback',
  'subject',
  'body',
  'notes',
  'reason',
  'meeting_url',
  'meetingUrl',
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

function isSafeField(key) {
  if (typeof key !== 'string') return false;
  return SAFE_FIELDS.has(key) || SAFE_FIELDS.has(key.toLowerCase());
}

function sanitizeInput(obj, excludedFields = [], depth = 0) {
  // Prevent stack overflow DoS attacks
  if (depth > 10 || !obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const val = obj[i];
      if (typeof val === 'string') {
        obj[i] = sanitizeString(val, false);
      } else if (isPlainObject(val) || Array.isArray(val)) {
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
      obj[key] = sanitizeString(val, isSafeField(key));
    } else if (isPlainObject(val) || Array.isArray(val)) {
      sanitizeInput(val, excludedFields, depth + 1);
    }
  }
}

function isAuthRoute(request) {
  if (!request) return false;
  const path =
    request.routerPath ||
    request.routeOptions?.url ||
    request.raw?.url ||
    request.url ||
    '';
  return (
    path.startsWith('/api/v1/auth') ||
    path.startsWith('/auth') ||
    path.includes('/auth/')
  );
}

function sanitizationMiddleware(request, reply, done) {
  if (isAuthRoute(request)) {
    if (typeof done === 'function') return done();
    return;
  }

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

  if (typeof done === 'function') {
    done();
  }
}

module.exports = {
  sanitizeInput,
  sanitizationMiddleware,
  isExcludedField,
  isAuthRoute,
};
