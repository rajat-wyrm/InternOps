'use strict';

/**
 * Feature Flag Service
 *
 * Evaluation priority (highest to lowest):
 *  1. DB `enabled` boolean  — hard on/off kill-switch
 *  2. `rollout_pct`         — percentage-based rollout via deterministic hash
 *  3. `allowed_roles`       — role allowlist (JSONB array in DB)
 *  4. Static default from flags.config.js
 *
 * Results are cached in an LRU cache (TTL = 30 s) to avoid hitting the DB
 * on every request while still reacting to changes within half a minute.
 * Call `service.invalidate(key)` or `service.invalidateAll()` immediately
 * after a PUT/disable operation to get zero-latency effect for admin actions.
 */

const crypto = require('crypto');
const { LRUCache } = require('lru-cache');
const repository = require('./repository');
const FLAGS = require('./flags.config');

// ─── LRU cache ───────────────────────────────────────────────────────────────
// Keyed by flag `key`. Each value is the raw DB row (or null if not in DB).
// TTL of 30 000 ms (30 seconds) balances freshness with DB load.
const CACHE_TTL_MS = 30_000;
const cache = new LRUCache({ max: 200, ttl: CACHE_TTL_MS });

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Deterministic 0-100 value from (userId + flagKey).
 * Using SHA-256 → first 4 bytes as a uint32 → modulo 101.
 * Same user always gets the same bucket for the same flag.
 * @param {string} userId
 * @param {string} flagKey
 * @returns {number} 0-100 inclusive
 */
function rolloutBucket(userId, flagKey) {
  const hash = crypto
    .createHash('sha256')
    .update(`${userId}:${flagKey}`)
    .digest();
  // Read first 4 bytes as big-endian uint32
  const num = hash.readUInt32BE(0);
  return num % 101; // 0-100 inclusive
}

/**
 * Load a flag row from cache or DB, merging with static config defaults.
 * @param {string} key
 * @returns {Promise<object>} merged flag object
 */
async function loadFlag(key) {
  if (cache.has(key)) return cache.get(key);

  const staticDef = FLAGS[key];
  if (!staticDef) return null; // Unknown flag — reject entirely

  let dbRow = await repository.findByKey(key);

  // Auto-provision the row if it doesn't exist yet
  if (!dbRow) {
    dbRow = await repository.upsert({
      key,
      enabled: staticDef.defaultEnabled,
      rolloutPct: staticDef.rolloutPct ?? 100,
      allowedRoles: null,
      description: staticDef.description,
      updatedBy: null,
    });
  }

  const merged = {
    key,
    enabled: dbRow.enabled,
    rolloutPct: dbRow.rollout_pct,
    allowedRoles: dbRow.allowed_roles ?? null, // string[] | null
    description: dbRow.description ?? staticDef.description,
    updatedAt: dbRow.updated_at,
    updatedBy: dbRow.updated_by,
    // Static default kept for reference
    defaultEnabled: staticDef.defaultEnabled,
  };

  cache.set(key, merged);
  return merged;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Evaluate a single flag for a user.
 *
 * @param {string} flagKey
 * @param {{ id?: string, role?: string }|null} user - pass null for anonymous
 * @returns {Promise<boolean>}
 */
async function isEnabled(flagKey, user = null) {
  const flag = await loadFlag(flagKey);
  if (!flag) return false; // Unknown flag → always off

  // 1. Hard kill-switch — if disabled in DB, always false
  if (!flag.enabled) return false;

  // 2. Role allowlist — if defined, user must have one of the allowed roles
  if (
    flag.allowedRoles &&
    Array.isArray(flag.allowedRoles) &&
    flag.allowedRoles.length > 0
  ) {
    if (!user?.role || !flag.allowedRoles.includes(user.role)) return false;
  }

  // 3. Percentage rollout — deterministic per-user bucket
  // bucket is 0-100 inclusive. We exclude users whose bucket >= rolloutPct
  // so that a rolloutPct of 50 passes exactly users in bucket [0, 49] (50%).
  if (flag.rolloutPct < 100) {
    if (!user?.id) return false; // Anonymous users not in rollout
    const bucket = rolloutBucket(user.id, flagKey);
    if (bucket >= flag.rolloutPct) return false;
  }

  return true;
}

/**
 * Evaluate all known flags for a user.
 * Used by the GET /feature-flags endpoint so the frontend gets one response.
 *
 * @param {{ id?: string, role?: string }|null} user
 * @returns {Promise<Record<string, boolean>>}
 */
async function getAllForUser(user = null) {
  const keys = Object.keys(FLAGS);
  const results = await Promise.all(
    keys.map(async (key) => [key, await isEnabled(key, user)])
  );
  return Object.fromEntries(results);
}

/**
 * Get all flag definitions (admin view — raw DB rows merged with config).
 * @returns {Promise<Array<object>>}
 */
async function getAllDefinitions() {
  // Ensure all static flags are provisioned in DB
  await Promise.all(Object.keys(FLAGS).map((key) => loadFlag(key)));
  const rows = await repository.findAll();
  return rows.map((row) => ({
    ...row,
    defaultEnabled: FLAGS[row.key]?.defaultEnabled ?? null,
  }));
}

/**
 * Invalidate the cache for a specific flag key.
 * Call this immediately after any PUT/disable so the next evaluation
 * reads fresh data instead of waiting for TTL expiry.
 * @param {string} key
 */
function invalidate(key) {
  cache.delete(key);
}

/**
 * Invalidate the entire flag cache.
 */
function invalidateAll() {
  cache.clear();
}

module.exports = {
  isEnabled,
  getAllForUser,
  getAllDefinitions,
  invalidate,
  invalidateAll,
};
