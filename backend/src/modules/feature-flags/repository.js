'use strict';

const pool = require('../../config/db');

/**
 * Fetch all feature_flags rows from the database.
 * @returns {Promise<Array<{key, enabled, rollout_pct, allowed_roles, description, updated_at, updated_by}>>}
 */
async function findAll() {
  const { rows } = await pool.query(
    `SELECT key, enabled, rollout_pct, allowed_roles, description, updated_at, updated_by
     FROM feature_flags
     ORDER BY key ASC`
  );
  return rows;
}

/**
 * Fetch a single flag row by key.
 * @param {string} key
 * @returns {Promise<object|null>}
 */
async function findByKey(key) {
  const { rows } = await pool.query(
    `SELECT key, enabled, rollout_pct, allowed_roles, description, updated_at, updated_by
     FROM feature_flags
     WHERE key = $1`,
    [key]
  );
  return rows[0] ?? null;
}

/**
 * Upsert a feature flag row (insert if missing, update if present).
 * @param {object} flag
 * @param {string} flag.key
 * @param {boolean} flag.enabled
 * @param {number} flag.rolloutPct     (0-100)
 * @param {string[]|null} flag.allowedRoles
 * @param {string} flag.description
 * @param {string|null} flag.updatedBy  user UUID
 * @returns {Promise<object>}
 */
async function upsert({
  key,
  enabled,
  rolloutPct,
  allowedRoles,
  description,
  updatedBy,
}) {
  const { rows } = await pool.query(
    `INSERT INTO feature_flags (key, enabled, rollout_pct, allowed_roles, description, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6)
     ON CONFLICT (key) DO UPDATE
       SET enabled       = EXCLUDED.enabled,
           rollout_pct   = EXCLUDED.rollout_pct,
           allowed_roles = EXCLUDED.allowed_roles,
           description   = EXCLUDED.description,
           updated_at    = NOW(),
           updated_by    = EXCLUDED.updated_by
     RETURNING *`,
    [
      key,
      enabled,
      rolloutPct ?? 100,
      allowedRoles ? JSON.stringify(allowedRoles) : null,
      description ?? null,
      updatedBy ?? null,
    ]
  );
  return rows[0];
}

/**
 * Instantly disable a flag (kill-switch).
 * @param {string} key
 * @param {string|null} updatedBy  user UUID
 * @returns {Promise<object|null>}
 */
async function disable(key, updatedBy) {
  const { rows } = await pool.query(
    `UPDATE feature_flags
     SET enabled = FALSE, updated_at = NOW(), updated_by = $2
     WHERE key = $1
     RETURNING *`,
    [key, updatedBy ?? null]
  );
  return rows[0] ?? null;
}

module.exports = { findAll, findByKey, upsert, disable };
