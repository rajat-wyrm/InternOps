// Basic input sanitization for common injection patterns
function sanitizeInput(obj, allowedFields = []) {
  if (typeof obj !== 'object' || obj === null) return;
  for (const key of Object.keys(obj)) {
    const val = obj[key];

    if (allowedFields.includes(key) && typeof val === 'string') {
      obj[key] = val.replace(/<[^>]*>/g, '');
    } else if (typeof val === 'object') {
      sanitizeInput(val, allowedFields);
    }
  }
}

function sanitizationMiddleware(request, reply, done) {
  const SAFE_FIELDS = ['name', 'description', 'message', 'title', 'content'];
  if (request.body) {
    sanitizeInput(request.body, SAFE_FIELDS);
  }
  done();
}

module.exports = sanitizationMiddleware;
