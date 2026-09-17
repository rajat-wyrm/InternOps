const GENERIC_MESSAGES = new Set([
  'failed',
  'request failed',
  'validation error',
  'validation failed',
  'something went wrong',
  'internal server error',
]);

const SECRET_PATTERN =
  /(?:api[-_ ]?key|token|secret|password|authorization|bearer|postgres(?:ql)?:\/\/|database_url|private[-_ ]?key)/i;

function cleanText(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || SECRET_PATTERN.test(text)) return null;
  return text;
}

function humanizePath(path) {
  const parts = Array.isArray(path)
    ? path
    : String(path || '')
        .replace(/^\//, '')
        .split(/[./]/);
  const value = parts.filter(Boolean).at(-1);
  if (!value) return null;
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());
}

function detailMessage(detail) {
  if (typeof detail === 'string') return cleanText(detail);
  if (!detail || typeof detail !== 'object') return null;
  const message = cleanText(detail.message || detail.msg || detail.description);
  if (!message) return null;
  const field = humanizePath(
    detail.path || detail.instancePath || detail.dataPath || detail.field
  );
  return field ? `${field}: ${message}` : message;
}

function firstDetailedMessage(data) {
  for (const collection of [data?.details, data?.errors, data?.issues]) {
    if (!Array.isArray(collection)) continue;
    for (const item of collection) {
      const message = detailMessage(item);
      if (message) return message;
    }
  }
  return null;
}

function isGeneric(message) {
  return (
    !message || GENERIC_MESSAGES.has(message.toLowerCase().replace(/[.!]$/, ''))
  );
}

export function getApiErrorInfo(error, fallback) {
  const response = error?.response;
  const data = response?.data;
  const status = response?.status;
  const requestId =
    cleanText(data?.requestId) ||
    cleanText(response?.headers?.['x-request-id']);
  const code = cleanText(data?.code) || null;

  if (!response) {
    if (error?.code === 'ECONNABORTED') {
      return {
        message: 'The request took too long. Please try again.',
        code: 'REQUEST_TIMEOUT',
        requestId: null,
      };
    }
    return {
      message:
        'Unable to connect to the InternOps server. Check your connection and try again.',
      code: 'NETWORK_ERROR',
      requestId: null,
    };
  }

  const detailed = firstDetailedMessage(data);
  const candidates = [
    data?.message,
    data?.error,
    data?.detail,
    data?.description,
  ]
    .map(cleanText)
    .filter(Boolean);
  const specific = candidates.find((message) => !isGeneric(message));

  let message = detailed || specific;
  if (!message) {
    const statusMessages = {
      401: 'Your session has expired. Sign in again to continue.',
      403: 'You do not have permission to perform this action.',
      404: 'The requested information could not be found.',
      409: 'This request conflicts with an existing record.',
      413: 'The selected file is too large.',
      429: 'Too many requests were made. Please wait and try again.',
    };
    message = statusMessages[status];
  }
  if (!message && status >= 500) {
    message =
      'The server could not complete this request. Please try again later.';
  }
  message =
    message || cleanText(fallback) || 'The request could not be completed.';
  if (requestId && status >= 500)
    message = `${message} Reference: ${requestId}`;

  return { message, code, requestId };
}

export function getApiErrorMessage(error, fallback) {
  return getApiErrorInfo(error, fallback).message;
}
