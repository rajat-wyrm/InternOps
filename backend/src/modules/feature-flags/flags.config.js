/**
 * flags.config.js — Feature Flag Registry
 *
 * This is the single source-of-truth for ALL known feature flags.
 * Every flag MUST be defined here before it can be used in the codebase.
 *
 * Fields:
 *   defaultEnabled {boolean} - Used when no DB row exists for this flag.
 *   description    {string}  - Human-readable description shown in the Admin UI.
 *   rolloutPct     {number}  - Default rollout percentage (0-100). Overridden by DB.
 *
 * HOW TO ADD A NEW FLAG:
 *   1. Add an entry here.
 *   2. Add a row to the next migration SQL file (see 026_feature_flags.sql as reference).
 *   3. Use in backend:  const { featureService } = require('../feature-flags/service');
 *                       featureService.isEnabled('MY_FLAG', req.user)
 *   4. Use in frontend: const enabled = useFeatureFlag('MY_FLAG');
 *                       <FeatureGate flag="MY_FLAG">...</FeatureGate>
 */
'use strict';

/** @type {Record<string, { defaultEnabled: boolean, description: string, rolloutPct?: number }>} */
const FLAGS = {
  NEW_DASHBOARD_V2: {
    defaultEnabled: false,
    description: 'Redesigned dashboard v2 UI with enhanced charts',
    rolloutPct: 100,
  },
  AI_CERT_GENERATOR: {
    defaultEnabled: true,
    description: 'AI-powered certificate generation via Gemini',
    rolloutPct: 100,
  },
  BULK_EXPORT_V2: {
    defaultEnabled: false,
    description: 'Improved bulk export with async queue and progress tracking',
    rolloutPct: 100,
  },
  CANVA_INTEGRATION: {
    defaultEnabled: true,
    description: 'Canva template-based certificate builder',
    rolloutPct: 100,
  },
  ADVANCED_ANALYTICS: {
    defaultEnabled: false,
    description: 'Advanced analytics charts and KPIs (experimental)',
    rolloutPct: 100,
  },
  MEETING_RECORDINGS: {
    defaultEnabled: false,
    description: 'Meeting recording upload and playback support',
    rolloutPct: 100,
  },
};

module.exports = FLAGS;
