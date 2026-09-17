import useFeatureFlag from '../hooks/useFeatureFlag';

/**
 * FeatureGate
 *
 * Conditionally renders `children` only when the given flag is enabled.
 * Renders `fallback` (or nothing) when the flag is off.
 *
 * @param {object}  props
 * @param {string}  props.flag      The flag key from flags.config.js
 * @param {React.ReactNode} props.children   Rendered when flag is ON
 * @param {React.ReactNode} [props.fallback] Rendered when flag is OFF (default: null)
 *
 * @example — simple guard:
 *   <FeatureGate flag="NEW_DASHBOARD_V2">
 *     <NewDashboard />
 *   </FeatureGate>
 *
 * @example — with fallback:
 *   <FeatureGate flag="ADVANCED_ANALYTICS" fallback={<ComingSoon />}>
 *     <AdvancedCharts />
 *   </FeatureGate>
 */
function FeatureGate({ flag, children, fallback = null }) {
  const enabled = useFeatureFlag(flag);
  return enabled ? children : fallback;
}

export default FeatureGate;
