import useFeatureFlagsStore from '../store/featureFlags';

/**
 * useFeatureFlag
 *
 * Returns whether a feature flag is enabled for the current user.
 * Reads from the in-memory Zustand store (populated at app boot).
 *
 * @param {string} flagKey  The flag key as defined in flags.config.js
 * @returns {boolean}
 *
 * @example
 *   const showV2 = useFeatureFlag('NEW_DASHBOARD_V2');
 *   if (!showV2) return <OldDashboard />;
 *   return <NewDashboard />;
 */
function useFeatureFlag(flagKey) {
  // Select only the specific flag value to avoid unnecessary re-renders
  return useFeatureFlagsStore((state) => state.flags[flagKey] === true);
}

export default useFeatureFlag;
