import { create } from 'zustand';
import { clearCsrfToken, registerAuthStore } from '../lib/axios';

// Hydrate from localStorage so a refresh keeps the session.
// We defer the read so it always runs inside a browser context and
// can never crash module import in environments without localStorage
// (SSR, tests, locked-down sandboxes, etc.).
function safeGet(key) {
  try {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem(key)
      : null;
  } catch {
    return null;
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

const initialToken = safeGet('accessToken');
const initialUser = safeGetJSON('user');

const useAuthStore = create((set) => ({
  accessToken: initialToken,
  user: initialUser,

  // hydrated stays false until the server-side /auth/refresh call in App.jsx
  // completes (success or failure). Private and RoleGuard render nothing while
  // hydrated is false, so manipulated localStorage data can NEVER be shown in
  // a protected route — the bootstrapping gap is fully closed.
  hydrated: false,

  // setAuth uses a functional updater so the new state is always computed
  // from the latest Zustand snapshot at dispatch time. Two concurrent callers
  // (e.g. the startup refresh and a simultaneous 401-triggered refresh) can
  // no longer race via a stale get() read: Zustand serialises the updates
  // internally and each updater receives the previous committed state.
  // localStorage is written inside the same updater so it is always in sync
  // with the Zustand write — there is no window where the two can disagree.
  setAuth: ({ accessToken, user }) =>
    set((prev) => {
      const nextToken =
        accessToken !== undefined ? accessToken : prev.accessToken;
      const nextUser = user !== undefined ? user : prev.user;

      if (accessToken !== undefined) safeSet('accessToken', accessToken);
      if (user !== undefined) safeSet('user', JSON.stringify(user));

      return { accessToken: nextToken, user: nextUser };
    }),

  setHydrated: () => set({ hydrated: true }),

  logout: () => {
    safeSet('accessToken', null);
    safeSet('user', null);
    clearCsrfToken();
    set({ accessToken: null, user: null });
  },
}));

// Give the axios interceptor a reference to the store so it can route all
// token/session mutations through setAuth and logout — preventing the store
// and localStorage from ever diverging after a silent refresh or expiry.
// This registration happens after the store is fully created, so there is
// no circular-import evaluation order issue.
registerAuthStore(useAuthStore);

export default useAuthStore;
