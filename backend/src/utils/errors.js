 

﻿class AppError extends Error {
  constructor(message, statusCode = 500, internalMessage = null) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.internalMessage = internalMessage;
    this.isOperational = true;

 
    Error.captureStackTrace(this, this.constructor);
  }
}

 
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 400);
  }
}


 
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', internalMessage = null) {
    super(message, 401, internalMessage);
  }
}

 
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

// -----------------------------------------------------------------------------
// 2. Database Error Sanitizer
// Strips sensitive Sequelize / Knex fields before they can leak to the client.
// -----------------------------------------------------------------------------
function sanitizeDbError(err) {
  // Sequelize errors carry .sql, .parameters, .original — strip them all
  const safeMessage =
    err.parent?.message ||   // underlying DB message (still internal, only for logs)
    err.message ||
    'Database error';

  return {
    // What we log server-side (full detail)
    fullError: err,
    // What we may show in dev (no raw SQL, no table names from .sql field)
    devMessage: safeMessage,
  };
}

// -----------------------------------------------------------------------------
// 3. Global Error Handler Middleware
// Must be registered LAST in Express (4-argument signature).
// -----------------------------------------------------------------------------
function globalErrorHandler(err, req, res, next) {
  const isProd = process.env.NODE_ENV === 'production';

  // --- Always log the full error on the server ---
  // In production use a real logger (e.g. Winston, Pino) instead of console.
  if (isProd) {
    // Minimal log in production — no stack spam, but still trackable
    console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, {
      name: err.name,
      message: err.message,
      status: err.status,
    });
  } else {
    // Full detail in development
    console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err);
  }

  // --- Determine HTTP status ---
  const statusCode = err.status || err.statusCode || 500;

  // --- Determine what to send to the client ---
  if (isProd) {
    // PRODUCTION: generic message for unexpected errors,
    // safe message for our own operational errors
    return res.status(statusCode).json({
      error: err.isOperational ? err.message : 'Internal Server Error',
      // ✅ Never send: stack, query, sql, detail, original, parameters
    });
  }

  // DEVELOPMENT: full detail so you can debug quickly
  // Handle DB errors specially to surface the useful part
  const isDatabaseError =
    err.name === 'SequelizeDatabaseError' ||
    err.name === 'SequelizeValidationError' ||
    err.name === 'SequelizeUniqueConstraintError' ||
    err.name === 'KnexTimeoutError';

  if (isDatabaseError) {
    const { devMessage } = sanitizeDbError(err);
    return res.status(statusCode).json({
      error: devMessage,
      type: err.name,
      // Show stack in dev, but NOT the raw .sql / .query fields
      stack: err.stack,
      hint: '(DB error — raw SQL is intentionally omitted even in dev mode)',
    });
  }

  // Standard error response for development
  return res.status(statusCode).json({
    error: err.message || 'Something went wrong',
    stack: err.stack,
  });
}

// -----------------------------------------------------------------------------
// 4. 404 Handler  (register BEFORE globalErrorHandler, AFTER all routes)
// -----------------------------------------------------------------------------
function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

class BadRequestError extends AppError {
  constructor(message = 'Bad Request', internalMessage = null) {
    super(message, 400, internalMessage);
  }
}


class ConflictError extends AppError {
  constructor(message = 'Conflict', internalMessage = null) {
    super(message, 409, internalMessage);
  }
}

module.exports = {
  AppError,
  UnauthorizedError,
  BadRequestError,
  ConflictError,
};
