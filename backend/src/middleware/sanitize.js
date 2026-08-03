const sanitizeHtml = require('sanitize-html');

const SENSITIVE_FIELDS = [
  'password',
  'newPassword',
  'oldPassword',
  'confirmPassword',
  'token',
  'refreshToken',
  'accessToken',
  'secret',
  'authorization',
  'cookie',
  'csrfToken',
];

const DEFAULT_SAFE_FIELDS = [
  'name',
  'full_name',
  'description',
  'message',
  'title',
  'content',
  'comment',
  'comments',
  'notes',
  'bio',
  'feedback',
  'reason',
  'subject',
  'body',
  'summary',
  'text',
];

function sanitizeInput(obj, allowedFields = DEFAULT_SAFE_FIELDS) {
  if (typeof obj !== 'object' || obj === null) return;

  for (const key of Object.keys(obj)) {
    const val = obj[key];

    if (typeof val === 'string') {
      if (SENSITIVE_FIELDS.includes(key)) {
        continue;
      }
      if (allowedFields.length > 0 && allowedFields.includes(key)) {
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
  const url =
    request.routerPath ??
    request.routeOptions?.url ??
    request.raw?.url ??
    request.url ??
    '';

  // Skip sanitization on auth routes
  if (url.includes('/auth') || url.startsWith('/api/v1/auth')) {
    if (typeof done === 'function') done();
    return;
  }

  const SAFE_FIELDS = DEFAULT_SAFE_FIELDS;

  if (request.body) {
    sanitizeInput(request.body, SAFE_FIELDS);
  }

  if (request.query) {
    sanitizeInput(request.query, SAFE_FIELDS);
  }

  if (request.params) {
    sanitizeInput(request.params, SAFE_FIELDS);
  }

  if (typeof done === 'function') done();
}

module.exports = { sanitizeInput, sanitizationMiddleware };
