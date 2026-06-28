import { create } from 'zustand';

// Hydrate from localStorage so a refresh keeps the session.
// We defer the read so it always runs inside a browser context and
// can never crash module import in environments without localStorage
// (SSR, tests, locked-down sandboxes, etc.).
let hasStorageError = false;

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

const useAuthStore = create((set, get) => ({
  accessToken: initialToken,
  user: initialUser,
  hydrated: false,
  storageError: hasStorageError,

  // setAuth always writes both fields together so partial updates
  // can't leave localStorage and the in-memory store disagree.
  setAuth: ({ accessToken, user }) => {
    const current = get();
    const nextToken =
      accessToken !== undefined ? accessToken : current.accessToken;
    const nextUser = user !== undefined ? user : current.user;

    if (accessToken !== undefined) safeSet('accessToken', accessToken);
    if (user !== undefined) safeSet('user', JSON.stringify(user));

    set({
      accessToken: nextToken,
      user: nextUser,
      storageError: hasStorageError,
    });
  },

  setHydrated: () => set({ hydrated: true }),

  logout: () => {
    safeSet('accessToken', null);
    safeSet('user', null);
    set({ accessToken: null, user: null, storageError: hasStorageError });
  },
}));

export default useAuthStore;
