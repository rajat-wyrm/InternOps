import axios from 'axios';
import { toast } from 'sonner';
import { captureException } from './sentry';
import { getApiErrorInfo, getApiErrorMessage } from './apiError';

export function getBaseUrl() {
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
  // "http://localhost:5000", "http://localhost:5000/api", or "http://localhost:5000/api/v1".
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

// Classifies a failed AI chat request (POST /ai/chat) into a single,
// user-friendly message. Callers that show this message inline should mark
// their request config with `_suppressGlobalError: true` so the global
// response interceptor below does not *also* toast a second, generic error
// for the same failure (see issue #1795).
function getAiChatErrorMessage(err) {
  if (!err?.response) {
    if (err?.code === 'ECONNABORTED') {
      return {
        message: 'The AI assistant took too long to respond. Please try again.',
        retryable: true,
      };
    }
    return {
      message:
        'Unable to reach the AI assistant. Check your connection and try again.',
      retryable: true,
    };
  }

  const status = err.response.status;

  if (status === 401 || status === 403) {
    return {
      message: "You don't have access to the AI assistant right now.",
      retryable: false,
    };
  }

  if (status === 429) {
    const responseData = err.response.data;
    const hasServerMessage = Boolean(
      responseData &&
      (responseData.error ||
        responseData.message ||
        responseData.detail ||
        responseData.description ||
        responseData.details?.length ||
        responseData.errors?.length)
    );
    return {
      message: hasServerMessage
        ? getApiErrorMessage(err)
        : "You've reached the AI assistant's usage limit. Please try again later.",
      retryable: false,
    };
  }

  if (status >= 500) {
    return {
      message:
        'The AI assistant is temporarily unavailable. Please try again in a moment.',
      retryable: true,
    };
  }

  const serverMessage = getApiErrorMessage(err);
  return {
    message:
      serverMessage || 'Could not process that request. Please try rephrasing.',
    retryable: false,
  };
}

function notifyGlobalApiError(err) {
  if (!shouldShowGlobalToast(err)) {
    return;
  }
  toast.error(getApiErrorMessage(err));
}

// The backend's CSRF guard requires the X-CSRF-Token header on mutating
// requests. We fetch a real token once and reuse it. If the call to obtain
// a real token fails we REFUSE to send the request — silently substituting
// a random string would defeat the protection since the server would still
// accept any non-empty header. The request will fail loudly with a 403,
// which is the correct behaviour when CSRF protection is unavailable.
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
    /* localStorage may be unavailable — ignore */
  }
}

// ---------------------------------------------------------------------------
// Auth-store bridge
// ---------------------------------------------------------------------------
// auth.js calls registerAuthStore() after the Zustand store is created.
// Using a registration pattern avoids a circular module dependency.
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
      // with a fake/spoofed token. The route handler will reject the
      // mutation with 403 if the server can't enforce CSRF.
      return Promise.reject(
        new Error('CSRF token unavailable; refusing unsafe request')
      );
    }
  }

  return config;
});

// Silent refresh: when an access token expires, the server returns 401.
// Before destroying the session, try the refresh-token flow once. The refresh
// token is stored in an HttpOnly cookie, so JavaScript cannot read it.
// The new access token is stored only in Zustand memory.
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

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

    const errorStatus = err.response?.status;
    if (errorStatus >= 500) {
      captureException(err, {
        tags: {
          source: 'api',
          statusCode: String(errorStatus),
          route: err.config?.url,
        },
        extra: { responseData: err.response?.data },
      });
    }

    const original = err.config || {};
    const status = err.response?.status;

    const isAuthRoute =
      original.url &&
      (original.url.includes('/auth/login') ||
        original.url.includes('/auth/refresh') ||
        original.url.includes('/auth/register'));

    const hasToken = !!getMemoryAccessToken();

    if (status === 401 && !original._retry && !isAuthRoute && hasToken) {
      // Another refresh is already in flight — queue this request.
      if (isRefreshing) {
        original._retry = true;

        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshRes = await api.post('/auth/refresh', {});
        const newToken = refreshRes.data?.accessToken;

        if (newToken) {
          const meRes = await api.get('/users/me', {
            headers: { Authorization: `Bearer ${newToken}` },
          });
          // Store refreshed token in memory only.
          if (_authStore) {
            _authStore
              .getState()
              .setAuth({ accessToken: newToken, user: meRes.data });
          }

          // The server rotated the refresh cookie. The CSRF token may also
          // have changed, so reset it so the next request picks up a fresh one.
          clearCsrfToken();
          removeLegacyAuthStorage();

          processQueue(null, newToken);

          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newToken}`;

          return api(original);
        }

        throw new Error('Refresh returned no token');
      } catch (refreshErr) {
        processQueue(refreshErr);

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
            /* ignore */
          }
        }

        // Emit an event that React Router can catch
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth:logout'));
        }

        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const errorInfo = getApiErrorInfo(err);
    err.userMessage = errorInfo.message;
    err.errorCode = errorInfo.code;
    err.requestId = errorInfo.requestId;
    notifyGlobalApiError(err);
    return Promise.reject(err);
  }
);

export default api;
export { clearCsrfToken, getAiChatErrorMessage, getApiErrorMessage };
