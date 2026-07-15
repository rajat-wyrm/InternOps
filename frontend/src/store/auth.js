import { create } from 'zustand';
import { clearCsrfToken, registerAuthStore } from '../lib/axios';

// Hydrate from localStorage so a refresh keeps the session.
// We defer the read so it always runs inside a browser context and
// can never crash module import in environments without localStorage
// (SSR, tests, locked-down sandboxes, etc.).
let hasStorageError = false;

// User metadata may be cached for lightweight UI bootstrapping, but the
// access token must never be persisted in localStorage. Keeping the access
// token memory-only reduces the impact of XSS because there is no
// localStorage token for injected scripts to steal.
//
// The refresh token is already stored by the backend as an HttpOnly cookie,
// and App.jsx refreshes the session on startup through /auth/refresh.
function safeGet(key) {
  try {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem(key)
      : null;
  } catch (err) {
    console.warn(
      `[localStorage] Failed to read key "${key}", falling back to sessionStorage:`,
      err
    );
    hasStorageError = true;
    try {
      return typeof window !== 'undefined'
        ? window.sessionStorage.getItem(key)
        : null;
    } catch (sessErr) {
      console.warn(`[sessionStorage] Failed to read key "${key}":`, sessErr);
      return null;
    }
  }
}

function safeSet(key, value) {
  try {
    if (typeof window === 'undefined') return;

    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch (err) {
    console.warn(
      `[localStorage] Failed to write key "${key}", falling back to sessionStorage:`,
      err
    );
    hasStorageError = true;
    try {
      if (value === null || value === undefined) {
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, value);
      }
    } catch (sessErr) {
      console.warn(`[sessionStorage] Failed to write key "${key}":`, sessErr);
    }
  }
}

function safeRemove(key) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* storage may be disabled — fall through */
  }
}

function safeGetJSON(key) {
  const raw = safeGet(key);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Remove any access token left behind by older app versions.
// This makes the fix effective immediately after deployment.
safeRemove('accessToken');

const initialUser = safeGetJSON('user');

const useAuthStore = create((set) => ({
  // Access token is intentionally memory-only.
  // It starts null on page reload and is silently reacquired through
  // /auth/refresh using the HttpOnly refresh cookie.
  accessToken: null,

  // User metadata is not a bearer secret. It is kept only to preserve lightweight
  // UI context during boot, while protected routes still wait for hydration.
  user: initialUser,

  // hydrated stays false until the server-side /auth/refresh call in App.jsx
  // completes. Private and RoleGuard render nothing while hydrated is false.
  hydrated: false,
  storageError: hasStorageError,
  systemError: null,

  setAuth: ({ accessToken, user }) =>
    set((prev) => {
      const nextToken =
        accessToken !== undefined ? accessToken : prev.accessToken;
      const nextUser = user !== undefined ? user : prev.user;

      // Never persist accessToken.
      // Also remove legacy token if any older code/version stored it.
      if (accessToken !== undefined) {
        safeRemove('accessToken');
      }

      if (user !== undefined) {
        if (user === null) {
          safeSet('user', null);
        } else {
          safeSet('user', JSON.stringify(user));
        }
      }

      return {
        accessToken: nextToken,
        user: nextUser,
        storageError: hasStorageError,
      };
    }),

  setHydrated: () => set({ hydrated: true }),

  setSystemError: (message) => set({ systemError: message }),

  logout: () => {
    // Thoroughly clear any legacy persisted token and cached user data.
    safeRemove('accessToken');
    safeSet('user', null);
    clearCsrfToken();
    set({ accessToken: null, user: null, storageError: hasStorageError });
  },
}));

// Give the axios interceptor a reference to the store so it can read the
// memory-only access token and route refresh/logout mutations through Zustand.
registerAuthStore(useAuthStore);

export default useAuthStore;
