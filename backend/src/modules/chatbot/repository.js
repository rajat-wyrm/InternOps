'use strict';

const pool = require('../../config/db');

/**
 * Searches active policies in the database by keyword matching
 */
async function searchPolicies(queryTerms = [], canViewSensitive = false) {
  if (!queryTerms || queryTerms.length === 0) return [];

  try {
    const sensitiveCondition = canViewSensitive
      ? ''
      : 'AND is_sensitive = FALSE';
    const query = `
      SELECT id, title, category, content, is_sensitive
      FROM policies
      WHERE is_active = TRUE ${sensitiveCondition}
      ORDER BY created_at DESC
      LIMIT 10;
    `;
    const res = await pool.query(query);
    const rows = res.rows || [];

    // Filter/score by keyword overlap
    const scored = [];
    for (const policy of rows) {
      const text = `${policy.title} ${policy.content}`.toLowerCase();
      let matchCount = 0;
      for (const term of queryTerms) {
        if (text.includes(term.toLowerCase())) {
          matchCount++;
        }
      }
      if (matchCount > 0) {
        scored.push({ policy, score: matchCount });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.policy);
  } catch (err) {
    // If table doesn't exist or DB is offline, fail gracefully without throwing
    return [];
  }
}

/**
 * Logs policy interaction to policy_chat_audit_log
 */
async function logInteraction(
  userId,
  question,
  policyIds = [],
  answeredFromCache = false
) {
  if (!userId) return null;
  try {
    const query = `
      INSERT INTO policy_chat_audit_log (user_id, question, policy_ids, answered_from_cache)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
    `;
    const res = await pool.query(query, [
      userId,
      question,
      policyIds,
      answeredFromCache,
    ]);
    return res.rows[0];
  } catch (err) {
    // Audit logging failure must never block response
    return null;
  }
}

module.exports = {
  searchPolicies,
  logInteraction,
};
