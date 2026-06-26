// frontend/src/store/auth.js
// Fix for Issue #592 — Silent failure of localStorage session management
// Changes:
//   1. safeGet / safeSet now log warnings on failure (dev) and expose a reason
//   2. Fallback chain: localStorage → sessionStorage → in-memory Map
//   3. useAuthStore gains `storageError` so the UI can surface a banner

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Storage abstraction with fallback chain
// Priority: localStorage → sessionStorage → in-memory
// ---------------------------------------------------------------------------

/** Shared in-memory fallback used when both Web Storage APIs are blocked. */
const _memStore = new Map();

/**
 * Determine the best available storage backend once at module load time.
 * Returns { backend: Storage | Map, type: 'localStorage' | 'sessionStorage' | 'memory' }
 */
function resolveStorageBackend() {
  const probe = '__internops_probe__';

  for (const [type, api] of [
    ['localStorage', () => window.localStorage],
    ['sessionStorage', () => window.sessionStorage],
  ]) {
    try {
      const storage = api();
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return { backend: storage, type };
    } catch {
      // This browser/tab cannot use this storage tier — try the next one.
    }
  }

  if (import.meta.env.DEV) {
    console.warn(
      '[InternOps auth] Both localStorage and sessionStorage are unavailable. ' +
      'Falling back to in-memory storage. Session will NOT persist across page reloads.',
    );
  }
  return { backend: _memStore, type: 'memory' };
}

const { backend: _storage, type: _storageType } = resolveStorageBackend();

/**
 * Read a JSON value from the active storage backend.
 * Returns the parsed value, or `null` on failure.
 * Sets `_lastStorageError` so callers can react to the failure.
 */
let _lastStorageError = null;

function safeGet(key) {
  _lastStorageError = null;
  try {
    if (_storage instanceof Map) {
      return _storage.get(key) ?? null;
    }
    const raw = _storage.getItem(key);
    return raw !== null ? JSON.parse(raw) : null;
  } catch (err) {
    _lastStorageError = err.message ?? String(err);
    if (import.meta.env.DEV) {
      console.warn(`[InternOps auth] safeGet("${key}") failed:`, err);
    }
    return null;
  }
}

/**
 * Write a JSON value to the active storage backend.
 * Returns `true` on success, `false` on failure.
 * Sets `_lastStorageError` so callers can react to the failure.
 */
function safeSet(key, value) {
  _lastStorageError = null;
  try {
    if (_storage instanceof Map) {
      _storage.set(key, value);
      return true;
    }
    _storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    _lastStorageError = err.message ?? String(err);
    if (import.meta.env.DEV) {
      console.warn(`[InternOps auth] safeSet("${key}") failed:`, err);
    }
    return false;
  }
}

/**
 * Remove a key from the active storage backend.
 */
function safeRemove(key) {
  try {
    if (_storage instanceof Map) {
      _storage.delete(key);
    } else {
      _storage.removeItem(key);
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[InternOps auth] safeRemove("${key}") failed:`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Storage-error message helpers
// ---------------------------------------------------------------------------

/**
 * Build a human-readable message the UI can show in a banner.
 * Returns null when everything is working fine.
 */
function buildStorageErrorMessage(storageType) {
  if (storageType === 'memory') {
    return (
      'Your browser's privacy settings are preventing session persistence. ' +
    'You will be signed out when you close this tab. ' +
      'To fix this, enable local storage / cookies for this site.'
    );
  }
  if (storageType === 'sessionStorage') {
    return (
      'Local storage is blocked; your session is stored in session storage instead. ' +
      'It will not persist if you close and reopen the browser tab.'
    );
  }
  return null; // localStorage is working fine
}

// ---------------------------------------------------------------------------
// Auth store
// ---------------------------------------------------------------------------

const AUTH_KEY = 'internops_auth';

export const useAuthStore = create((set, get) => ({
  // ----- persisted state -----
  user: safeGet(AUTH_KEY)?.user ?? null,
  token: safeGet(AUTH_KEY)?.token ?? null,

  // ----- storage health -----
  /**
   * Which storage backend is currently active.
   * One of: 'localStorage' | 'sessionStorage' | 'memory'
   */
  storageType: _storageType,

  /**
   * Non-null string when session persistence is degraded or unavailable.
   * Bind this in your UI to show a dismissible warning banner.
   *
   * Example (React):
   *   const storageError = useAuthStore(s => s.storageError);
   *   {storageError && <Banner variant="warning">{storageError}</Banner>}
   */
  storageError: buildStorageErrorMessage(_storageType),

  // ----- actions -----

  /**
   * Call after a successful login API response.
   * Persists user + token and clears any previous storage error.
   */
  login(user, token) {
    const ok = safeSet(AUTH_KEY, { user, token });
    set({
      user,
      token,
      storageError: ok
        ? buildStorageErrorMessage(_storageType)
        : `Session data could not be saved (${_lastStorageError ?? 'unknown error'}). ` +
        'Your session may not persist after a page refresh.',
    });
  },

  /**
   * Call on logout or when the API returns 401.
   */
  logout() {
    safeRemove(AUTH_KEY);
    set({ user: null, token: null, storageError: buildStorageErrorMessage(_storageType) });
  },

  /**
   * Rehydrate from storage (call once on app mount, e.g. in App.jsx useEffect).
   * Useful after a hard refresh to restore the session from whatever backend is active.
   */
  rehydrate() {
    const saved = safeGet(AUTH_KEY);
    if (saved?.user && saved?.token) {
      set({
        user: saved.user,
        token: saved.token,
        storageError: buildStorageErrorMessage(_storageType),
      });
    } else if (_lastStorageError) {
      set({
        storageError:
          `Could not read saved session (${_lastStorageError}). ` +
          'Please sign in again.',
      });
    }
  },
}));