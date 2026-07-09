import axios from 'axios';

function getBaseUrl() {
  const raw = import.meta.env.VITE_API_URL;
  if (!raw) return '/api';
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) {
    console.warn(
      `[api] VITE_API_URL "${raw}" has no protocol; defaulting to http://`
    );
    url = `http://${url}`;
  }
  url = url.replace(/\/+$/, '');

  return url;
}
const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
  timeout: 15000,
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

function handleLogout() {
  try {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('user');
      } catch {
        /* ignore localStorage unavailability */
      }

      clearCsrfToken();

      try {
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      } catch {
        /* ignore location assignment errors */
      }
    } else {
      // If there's no window (SSR), still clear tokens in memory
      clearCsrfToken();
    }
  } catch {
    /* defensive: ensure logout doesn't throw */
    clearCsrfToken();
  }
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
          // Store refreshed token in memory only.
          if (_authStore) {
            _authStore.getState().setAuth({ accessToken: newToken });
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

        if (
          typeof window !== 'undefined' &&
          !window.location.pathname.startsWith('/login')
        ) {
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
