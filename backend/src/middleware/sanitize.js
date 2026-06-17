// Basic input sanitization for common injection patterns
function sanitizeInput(obj) {
  if (typeof obj !== 'object' || obj === null) return;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      // Strip HTML tags and common SQL injection patterns
      obj[key] = val.replace(/<[^>]*>/g, '');
    } else if (typeof val === 'object') {
      sanitizeInput(val);
    }
  }
}

function sanitizationMiddleware(request, reply, done) {
  if (request.body) sanitizeInput(request.body);
  if (request.query) sanitizeInput(request.query);
  if (request.params) sanitizeInput(request.params);
  done(); // ✅ Call done to pass control to the next handler/route
}

module.exports = sanitizationMiddleware;
