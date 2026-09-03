export function getApiErrorMessage(error, fallback = 'Something went wrong') {
  if (!error) return fallback;

  const data = error.response?.data;

  // New standardized API error format
  if (data?.message) {
    return data.message;
  }

  // Backward compatibility with the old { error: '...' } format
  if (data?.error) {
    return data.error;
  }

  // Axios/network error
  if (error.message && !error.response) {
    return error.message;
  }

  return fallback;
}

export function getApiErrorDetails(error) {
  return error?.response?.data?.details ?? [];
}

export function getApiErrorCode(error) {
  return error?.response?.data?.code ?? null;
}
