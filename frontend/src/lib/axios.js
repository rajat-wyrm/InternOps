import axios from 'axios';

// All backend routes are mounted under /api; Vite proxies this to :5000 in dev.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

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

// ---------------------------------------------------------------------------
// Auth-store bridge
// ---------------------------------------------------------------------------
// auth.js calls registerAuthStore() after the Zustand store is created.
// Using a registration pattern (rather than a direct import) avoids a circular
// module dependency: auth.js already imports clearCsrfToken from this file, so
// this file must not import from auth.js at module-evaluation time.
// All mutations (new token on refresh, logout on expiry) are routed through
// the store so that Zustand state and localStorage never diverge.
// ---------------------------------------------------------------------------
let _authStore = null;

export function registerAuthStore(store) {
  _authStore = store;
}

api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    try {
      config.headers['X-CSRF-Token'] = await getCsrfToken();
    } catch (err) {
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
// Before destroying the session, try the refresh-token flow once. If that
// fails, fall through to the original "drop session" behaviour.
// Uses a formal queue to prevent race conditions when multiple concurrent
// requests trigger simultaneous 401 responses — the first initiates the
// refresh, the rest await the same result via the queue.
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
    // Globally log the error to the browser console
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

    if (status === 401 && !original._retry && !isAuthRoute) {
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
          // Route the new token through the store so Zustand in-memory state
          // and localStorage are updated atomically — direct localStorage.setItem
          // would leave the Zustand store holding the old (expired) token.
          if (_authStore) {
            _authStore.getState().setAuth({ accessToken: newToken });
          } else {
            localStorage.setItem('accessToken', newToken);
          }
          // The server rotated the refresh cookie. The CSRF token may also
          // have changed (some implementations bind them together), so reset
          // it so the next request picks up the new one.
          clearCsrfToken();
          processQueue(null, newToken);
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
        throw new Error('Refresh returned no token');
      } catch (refreshErr) {
        processQueue(refreshErr);
        // Route the logout through the store so Zustand clears accessToken and
        // user atomically with localStorage — previously only localStorage was
        // cleared here, leaving the in-memory store stale until the next render.
        if (_authStore) {
          _authStore.getState().logout();
        } else {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          clearCsrfToken();
        }

        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export default api;
export { clearCsrfToken };
