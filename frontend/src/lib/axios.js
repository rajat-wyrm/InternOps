import axios from 'axios';

import { toast } from 'sonner';

function getBaseUrl() {
  const raw = import.meta.env.VITE_API_URL;

  if (!raw) return '/api/v1';

  let url = raw.trim();

  if (!/^https?:\/\//i.test(url)) {
    console.warn(
      `[api] VITE_API_URL "${raw}" has no protocol; defaulting to http://`
    );
    url = `http://${url}`;
  }

  url = url.replace(/\/+$/, '');

  // Normalize bare API URLs to the versioned backend path.
  // This keeps API calls working correctly when VITE_API_URL is set to
  // "http://localhost:5000", "http://localhost:5000/api",
  // or "http://localhost:5000/api/v1".
  const hasApiVersionPath = /\/api\/v\d+(?:\/|$)/i.test(url);
  const hasApiOnlyPath = /\/api$/i.test(url);

  if (!hasApiVersionPath) {
    if (hasApiOnlyPath) {
      url = url.replace(/\/api$/i, '/api/v1');
    } else {
      url = `${url}/api/v1`;
    }
  }

  return url;
}

const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
  timeout: 15000,
});

function getApiErrorMessage(responseData) {
  if (!responseData) return null;

  if (typeof responseData === 'string') return responseData;

  if (typeof responseData.error === 'string' && responseData.error.trim()) {
    return responseData.error.trim();
  }

  if (typeof responseData.message === 'string' && responseData.message.trim()) {
    return responseData.message.trim();
  }

  if (typeof responseData.detail === 'string' && responseData.detail.trim()) {
    return responseData.detail.trim();
  }

  if (
    typeof responseData.description === 'string' &&
    responseData.description.trim()
  ) {
    return responseData.description.trim();
  }

  if (Array.isArray(responseData.errors) && responseData.errors.length) {
    const firstError = responseData.errors[0];

    if (typeof firstError === 'string') {
      return firstError;
    }

    if (typeof firstError?.message === 'string' && firstError.message.trim()) {
      return firstError.message.trim();
    }
  }

  return null;
}

function shouldShowGlobalToast(err) {
  const original = err.config || {};

  const isAuthRoute =
    original.url &&
    (original.url.includes('/auth/login') ||
      original.url.includes('/auth/refresh') ||
      original.url.includes('/auth/register'));

  return !(
    original._retry ||
    original._suppressGlobalError ||
    isAuthRoute ||
    original.url?.includes('/auth/refresh')
  );
}

function notifyGlobalApiError(err) {
  if (!shouldShowGlobalToast(err)) {
    return;
  }

  if (!err.response) {
    const networkMessage =
      err.code === 'ECONNABORTED'
        ? 'The request timed out. Please check your connection and try again.'
        : 'Unable to connect to the server. Check your internet connection and try again.';

    toast.error(networkMessage);
    return;
  }

  const status = err.response.status;
  const serverMessage = getApiErrorMessage(err.response.data);

  const message =
    status >= 500
      ? 'Something went wrong on our side. Please try again later.'
      : serverMessage ||
        'Request failed. Please check your input and try again.';

  toast.error(message);
}

// ---------------------------------------------------------------------------
// CSRF protection
// ---------------------------------------------------------------------------

let csrfToken = null;
let csrfPromise = null;
let csrfGeneration = 0;

async function getCsrfToken() {
  if (csrfToken) {
    return csrfToken;
  }

  if (csrfPromise) {
    return csrfPromise;
  }

  const generation = csrfGeneration;

  csrfPromise = api
    .get('/auth/csrf-token')
    .then((res) => {
      // Ignore stale responses that finished after a token reset.
      if (generation !== csrfGeneration) {
        throw new Error('Discarding stale CSRF token');
      }

      csrfToken = res.data.csrfToken;

      return csrfToken;
    })
    .finally(() => {
      csrfPromise = null;
    });

  return csrfPromise;
}

function clearCsrfToken() {
  csrfGeneration++;
  csrfToken = null;
  csrfPromise = null;
}

function removeLegacyAuthStorage() {
  try {
    if (typeof window === 'undefined') return;

    // Remove user metadata cached in localStorage.
    // Access tokens are memory-only and never stored in localStorage.
    window.localStorage.removeItem('user');
  } catch {
    // localStorage may be unavailable — ignore.
  }
}

// ---------------------------------------------------------------------------
// Auth-store bridge
// ---------------------------------------------------------------------------

// auth.js calls registerAuthStore() after the Zustand store is created.
// Using a registration pattern avoids a circular module dependency.
//
// Access tokens are read from Zustand memory only and are never read from or
// written to localStorage.
// ---------------------------------------------------------------------------

let _authStore = null;

export function registerAuthStore(store) {
  _authStore = store;
  removeLegacyAuthStorage();
}

function getMemoryAccessToken() {
  return _authStore?.getState?.()?.accessToken || null;
}

// ---------------------------------------------------------------------------
// Request interceptor
// ---------------------------------------------------------------------------

api.interceptors.request.use(async (config) => {
  const token = getMemoryAccessToken();

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  const method = (config.method || 'get').toLowerCase();

  if (!['get', 'head', 'options'].includes(method)) {
    try {
      config.headers = config.headers || {};

      config.headers['X-CSRF-Token'] = await getCsrfToken();
    } catch {
      // Surface a real error rather than allowing the request through
      // with a fake/spoofed token.
      return Promise.reject(
        new Error('CSRF token unavailable; refusing unsafe request')
      );
    }
  }

  return config;
});

// ---------------------------------------------------------------------------
// Automatic refresh-token rotation
// ---------------------------------------------------------------------------
//
// When an access token expires, the API returns 401.
//
// The refresh token is stored in an HttpOnly cookie, so JavaScript cannot
// access it directly.
//
// A shared promise ensures that multiple simultaneous 401 responses do not
// trigger multiple refresh requests.
//
// Example:
//
// Request A -> 401
// Request B -> 401
// Request C -> 401
//
// Only ONE refresh request is sent:
//
// A -> refresh
// B -> waits
// C -> waits
//
// All three requests then use the new access token.
//
// This is important because refresh-token rotation can invalidate the old
// refresh token when it is consumed.
// ---------------------------------------------------------------------------

let sharedRefreshPromise = null;

async function performRefresh() {
  const refreshRes = await api.post('/auth/refresh', {});

  const newToken = refreshRes.data?.accessToken;

  if (!newToken) {
    throw new Error('Refresh response did not contain an access token');
  }

  // Store the new access token in memory only.
  //
  // If the refresh endpoint returns the user, use it.
  // Otherwise preserve the currently authenticated user.
  if (_authStore) {
    const currentUser = _authStore.getState()?.user;
    const refreshedUser = refreshRes.data?.user || currentUser;

    _authStore.getState().setAuth({
      accessToken: newToken,
      user: refreshedUser,
    });
  }

  // The refresh endpoint rotates the refresh cookie.
  // Reset the CSRF token so the next unsafe request obtains a fresh token.
  clearCsrfToken();

  // Remove any old authentication data from localStorage.
  removeLegacyAuthStorage();

  return newToken;
}

function refreshSession() {
  // If a refresh operation is already running, return the same promise.
  if (sharedRefreshPromise) {
    return sharedRefreshPromise;
  }

  sharedRefreshPromise = performRefresh().finally(() => {
    // Allow a future refresh after this refresh operation finishes.
    sharedRefreshPromise = null;
  });

  return sharedRefreshPromise;
}

// ---------------------------------------------------------------------------
// Response interceptor
// ---------------------------------------------------------------------------

api.interceptors.response.use(
  (res) => {
    const url = res.config?.url;

    if (
      url &&
      (url.includes('/auth/login') ||
        url.includes('/auth/logout') ||
        url.includes('/me/revoke-all') ||
        url.includes('/auth/reset-password'))
    ) {
      clearCsrfToken();
    }

    return res;
  },

  async (err) => {
    console.error(
      '[Global API Error]',
      err.response?.data || err.message,
      err.config?.url
    );

    const original = err.config || {};
    const status = err.response?.status;

    const isAuthRoute =
      original.url &&
      (original.url.includes('/auth/login') ||
        original.url.includes('/auth/refresh') ||
        original.url.includes('/auth/register'));

    const hasToken = !!getMemoryAccessToken();

    // -----------------------------------------------------------------------
    // Access token expired -> automatically refresh
    // -----------------------------------------------------------------------

    if (status === 401 && !original._retry && !isAuthRoute && hasToken) {
      // Mark this request so it can never enter the refresh flow twice.
      original._retry = true;

      try {
        // Use the shared refresh promise.
        //
        // If another request is already refreshing, this request waits for
        // that same refresh operation.
        const newToken = await refreshSession();

        original.headers = original.headers || {};

        original.headers.Authorization = `Bearer ${newToken}`;

        // Retry the original API request using the rotated access token.
        return api(original);
      } catch (refreshErr) {
        // -------------------------------------------------------------------
        // Refresh failed.
        //
        // This means the refresh token may be expired, invalid, revoked,
        // or rejected because of token replay/rotation rules.
        //
        // Clear the global authentication state and allow the application
        // to redirect the user to login.
        // -------------------------------------------------------------------

        if (_authStore) {
          _authStore.getState().logout();
        } else {
          removeLegacyAuthStorage();
          clearCsrfToken();

          try {
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem('user');
            }
          } catch {
            // ignore
          }
        }

        // Emit an event that React Router can catch.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth:logout'));
        }

        return Promise.reject(refreshErr);
      }
    }

    // -----------------------------------------------------------------------
    // Normal API error
    // -----------------------------------------------------------------------

    notifyGlobalApiError(err);

    return Promise.reject(err);
  }
);

export default api;

export { clearCsrfToken };
