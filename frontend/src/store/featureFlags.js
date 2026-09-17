import { create } from 'zustand';
import api from '../lib/axios';

/**
 * Feature Flags Store
 *
 * Fetches all feature flags from the backend once at app boot (after auth
 * hydration) and stores them in memory. Components consume flags via the
 * useFeatureFlag hook or the <FeatureGate> component.
 *
 * Boot-fetch strategy:
 *  - One network request at startup → no per-component fetch overhead.
 *  - Flags are evaluated server-side per-user (% rollout + role allowlist).
 *  - Call `refresh()` if you need to re-sync after an admin toggle.
 */
const useFeatureFlagsStore = create((set, get) => ({
  /** @type {Record<string, boolean>} flag key → enabled boolean */
  flags: {},

  /** Whether the initial fetch has completed (success or failure). */
  loaded: false,

  /** Any fetch error message. */
  error: null,

  /**
   * Fetch all flags for the current user from the backend.
   * Called once after successful auth refresh in App.jsx.
   * Safe to call multiple times — subsequent calls just re-sync.
   */
  fetchFlags: async () => {
    try {
      const res = await api.get('/feature-flags');
      set({ flags: res.data.flags ?? {}, loaded: true, error: null });
    } catch (err) {
      // On failure, keep any previously loaded flags and mark as loaded
      // so the app doesn't block on a flag fetch error.
      const message =
        err?.response?.data?.error ?? 'Failed to load feature flags';
      console.warn('[FeatureFlags] Fetch failed:', message);
      set((prev) => ({ loaded: true, error: message, flags: prev.flags }));
    }
  },

  /**
   * Re-fetch all flags. Call after an admin toggles a flag via the UI.
   */
  refresh: async () => {
    set({ loaded: false, error: null });
    return get().fetchFlags();
  },

  /**
   * Check if a specific flag is enabled.
   * @param {string} key
   * @returns {boolean}
   */
  isEnabled: (key) => get().flags[key] === true,

  /**
   * Reset the store on logout.
   */
  reset: () => set({ flags: {}, loaded: false, error: null }),
}));

export default useFeatureFlagsStore;
