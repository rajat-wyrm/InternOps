class AppError extends Error {
  constructor(message, statusCode = 500, internalMessage = null) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.internalMessage = internalMessage;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', internalMessage = null) {
    super(message, 401, internalMessage);
  }
}

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
