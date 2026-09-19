/**
 * alert.repository.js
 *
 * Database operations for performance_alerts and performance_alert_events.
 * Implements deduplication, cooldown, escalation, and state transitions.
 */
const pool = require('../../config/db');

// Default cooldown: 48 hours before an identical alert can fire again
const DEFAULT_COOLDOWN_HOURS = parseInt(
  process.env.PERF_ALERT_COOLDOWN_HOURS || '48',
  10
);

// ---------------------------------------------------------------------------
// Create or update/escalate an alert (deduplication logic)
// ---------------------------------------------------------------------------
async function upsertAlert({
  internId,
  alertType,
  severity,
  title,
  description,
  recommendation,
  factors = [],
  riskScore,
  confidence,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check existing ACTIVE alert for this intern+type
    const existing = await client.query(
      `SELECT * FROM performance_alerts
       WHERE intern_id = $1 AND alert_type = $2 AND status = 'ACTIVE'
       FOR UPDATE`,
      [internId, alertType]
    );

    let alert;
    let eventType;
    let oldSeverity = null;

    if (existing.rows.length > 0) {
      const prev = existing.rows[0];
      oldSeverity = prev.severity;

      // Check if cooldown has passed — if not, just update details
      const cooldownPassed =
        !prev.cooldown_until || new Date(prev.cooldown_until) <= new Date();

      const severityRanks = {
        INFO: 0,
        LOW: 1,
        MEDIUM: 2,
        HIGH: 3,
        CRITICAL: 4,
      };
      const isEscalation =
        (severityRanks[severity] || 0) > (severityRanks[prev.severity] || 0);

      const cooldownUntil = new Date(
        Date.now() + DEFAULT_COOLDOWN_HOURS * 3600000
      ).toISOString();

      const res = await client.query(
        `UPDATE performance_alerts SET
           severity = $1,
           title = $2,
           description = $3,
           recommendation = $4,
           factors = $5::jsonb,
           risk_score_at_alert = $6,
           confidence_at_alert = $7,
           last_triggered_at = NOW(),
           trigger_count = trigger_count + 1,
           cooldown_until = $8,
           updated_at = NOW()
         WHERE id = $9
         RETURNING *`,
        [
          severity,
          title,
          description,
          recommendation,
          JSON.stringify(factors),
          riskScore || null,
          confidence || null,
          cooldownPassed ? cooldownUntil : prev.cooldown_until,
          prev.id,
        ]
      );
      alert = res.rows[0];
      eventType = isEscalation ? 'SEVERITY_ESCALATED' : 'RETRIGGERED';
    } else {
      // Create new alert
      const cooldownUntil = new Date(
        Date.now() + DEFAULT_COOLDOWN_HOURS * 3600000
      ).toISOString();

      const res = await client.query(
        `INSERT INTO performance_alerts (
           intern_id, alert_type, severity, title, description,
           recommendation, factors, risk_score_at_alert, confidence_at_alert,
           cooldown_until
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)
         RETURNING *`,
        [
          internId,
          alertType,
          severity,
          title,
          description,
          recommendation,
          JSON.stringify(factors),
          riskScore || null,
          confidence || null,
          cooldownUntil,
        ]
      );
      alert = res.rows[0];
      eventType = 'CREATED';
    }

    // Record event
    await client.query(
      `INSERT INTO performance_alert_events
         (alert_id, intern_id, event_type, old_severity, new_severity, details)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        alert.id,
        internId,
        eventType,
        oldSeverity,
        severity,
        JSON.stringify({ risk_score: riskScore, confidence }),
      ]
    );

    await client.query('COMMIT');
    return { alert, eventType, isNew: eventType === 'CREATED' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Resolve any ACTIVE alerts for an intern that no longer apply
// (called when risk returns to acceptable level)
// ---------------------------------------------------------------------------
async function autoResolveAlerts(internId, alertTypes, resolutionNote) {
  if (!alertTypes || alertTypes.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query(
      `UPDATE performance_alerts SET
         status = 'RESOLVED',
         resolved_at = NOW(),
         resolution_note = $1,
         updated_at = NOW()
       WHERE intern_id = $2 AND alert_type = ANY($3::text[]) AND status = 'ACTIVE'
       RETURNING id, intern_id, alert_type`,
      [
        resolutionNote || 'Risk returned to acceptable level',
        internId,
        alertTypes,
      ]
    );

    for (const row of res.rows) {
      await client.query(
        `INSERT INTO performance_alert_events
           (alert_id, intern_id, event_type, old_status, new_status, details)
         VALUES ($1,$2,'RESOLVED','ACTIVE','RESOLVED',$3::jsonb)`,
        [row.id, row.intern_id, JSON.stringify({ auto_resolved: true })]
      );
    }

    await client.query('COMMIT');
    return res.rows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Acknowledge an alert
// ---------------------------------------------------------------------------
async function acknowledgeAlert(alertId, actorId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query(
      `UPDATE performance_alerts SET
         status = 'ACKNOWLEDGED',
         acknowledged_by = $1,
         acknowledged_at = NOW(),
         updated_at = NOW()
       WHERE id = $2 AND status = 'ACTIVE'
       RETURNING *`,
      [actorId, alertId]
    );

    if (res.rowCount === 0) {
      throw Object.assign(new Error('Alert not found or not in ACTIVE state'), {
        statusCode: 404,
      });
    }

    await client.query(
      `INSERT INTO performance_alert_events
         (alert_id, intern_id, actor_id, event_type, old_status, new_status)
       VALUES ($1,$2,$3,'ACKNOWLEDGED','ACTIVE','ACKNOWLEDGED')`,
      [alertId, res.rows[0].intern_id, actorId]
    );

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Resolve an alert
// ---------------------------------------------------------------------------
async function resolveAlert(alertId, actorId, resolutionNote) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query(
      `UPDATE performance_alerts SET
         status = 'RESOLVED',
         resolved_by = $1,
         resolved_at = NOW(),
         resolution_note = $2,
         updated_at = NOW()
       WHERE id = $3 AND status IN ('ACTIVE','ACKNOWLEDGED')
       RETURNING *`,
      [actorId, resolutionNote || null, alertId]
    );

    if (res.rowCount === 0) {
      throw Object.assign(new Error('Alert not found or already resolved'), {
        statusCode: 404,
      });
    }

    await client.query(
      `INSERT INTO performance_alert_events
         (alert_id, intern_id, actor_id, event_type, old_status, new_status, details)
       VALUES ($1,$2,$3,'RESOLVED',$4,'RESOLVED',$5::jsonb)`,
      [
        alertId,
        res.rows[0].intern_id,
        actorId,
        res.rows[0].status === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'ACTIVE',
        JSON.stringify({ note: resolutionNote }),
      ]
    );

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// List alerts (for dashboard / intern detail / mentor view)
// ---------------------------------------------------------------------------
async function listAlerts({
  internId,
  status,
  severity,
  alertType,
  requestingUserId,
  requestingUserRole,
  page = 1,
  limit = 50,
}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  // RBAC: TL/Captain see only subordinates
  if (requestingUserRole === 'TL' || requestingUserRole === 'CAPTAIN') {
    params.push(requestingUserId);
    conditions.push(`pa.intern_id IN (
      WITH RECURSIVE subordinates AS (
        SELECT id FROM users WHERE manager_id = $${params.length} AND deleted_at IS NULL
        UNION ALL
        SELECT usr.id FROM users usr
        JOIN subordinates s ON usr.manager_id = s.id WHERE usr.deleted_at IS NULL
      )
      SELECT id FROM subordinates
    )`);
  }

  if (internId) {
    params.push(internId);
    conditions.push(`pa.intern_id = $${params.length}`);
  }
  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    params.push(statuses);
    conditions.push(`pa.status = ANY($${params.length}::text[])`);
  }
  if (severity) {
    params.push(severity);
    conditions.push(`pa.severity = $${params.length}`);
  }
  if (alertType) {
    params.push(alertType);
    conditions.push(`pa.alert_type = $${params.length}`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const countRes = await pool.query(
    `SELECT COUNT(*) FROM performance_alerts pa ${whereClause}`,
    params
  );
  const total = Number(countRes.rows[0].count);

  const dataParams = [...params, limit, offset];
  const limitIdx = dataParams.length - 1;
  const offsetIdx = dataParams.length;

  const res = await pool.query(
    `SELECT
       pa.*,
       u.full_name AS intern_name,
       u.email AS intern_email,
       d.name AS department_name,
       ack_u.full_name AS acknowledged_by_name,
       res_u.full_name AS resolved_by_name
     FROM performance_alerts pa
     JOIN users u ON u.id = pa.intern_id
     LEFT JOIN departments d ON d.id = u.department_id
     LEFT JOIN users ack_u ON ack_u.id = pa.acknowledged_by
     LEFT JOIN users res_u ON res_u.id = pa.resolved_by
     ${whereClause}
     ORDER BY
       CASE pa.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END,
       pa.last_triggered_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    dataParams
  );

  return { data: res.rows, total, page, limit };
}

// ---------------------------------------------------------------------------
// Get alert by ID (with access check data)
// ---------------------------------------------------------------------------
async function getAlertById(alertId) {
  const res = await pool.query(
    `SELECT pa.*, u.full_name AS intern_name, u.manager_id
     FROM performance_alerts pa
     JOIN users u ON u.id = pa.intern_id
     WHERE pa.id = $1`,
    [alertId]
  );
  return res.rows[0] || null;
}

// ---------------------------------------------------------------------------
// Count active alerts for summary
// ---------------------------------------------------------------------------
async function getActiveAlertSummary(requestingUserId, requestingUserRole) {
  let subordinateFilter = '';
  const params = [];

  if (requestingUserRole === 'TL' || requestingUserRole === 'CAPTAIN') {
    params.push(requestingUserId);
    subordinateFilter = `AND pa.intern_id IN (
      WITH RECURSIVE subordinates AS (
        SELECT id FROM users WHERE manager_id = $1 AND deleted_at IS NULL
        UNION ALL
        SELECT usr.id FROM users usr
        JOIN subordinates s ON usr.manager_id = s.id WHERE usr.deleted_at IS NULL
      )
      SELECT id FROM subordinates
    )`;
  }

  const res = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE pa.status = 'ACTIVE') AS active,
       COUNT(*) FILTER (WHERE pa.status = 'ACKNOWLEDGED') AS acknowledged,
       COUNT(*) FILTER (WHERE pa.severity = 'CRITICAL' AND pa.status = 'ACTIVE') AS critical_active,
       COUNT(*) FILTER (WHERE pa.severity = 'HIGH' AND pa.status = 'ACTIVE') AS high_active,
       COUNT(*) FILTER (WHERE pa.alert_type = 'ATTENDANCE_RISK' AND pa.status = 'ACTIVE') AS attendance_alerts,
       COUNT(*) FILTER (WHERE pa.alert_type = 'DEADLINE_RISK' AND pa.status = 'ACTIVE') AS deadline_alerts,
       COUNT(*) FILTER (WHERE pa.alert_type = 'TASK_COMPLETION_RISK' AND pa.status = 'ACTIVE') AS task_alerts,
       COUNT(*) FILTER (WHERE pa.alert_type IN ('CRITICAL_RISK','HIGH_RISK') AND pa.status = 'ACTIVE') AS risk_alerts
     FROM performance_alerts pa
     WHERE 1=1
     ${subordinateFilter}`,
    params
  );
  return res.rows[0];
}

module.exports = {
  upsertAlert,
  autoResolveAlerts,
  acknowledgeAlert,
  resolveAlert,
  listAlerts,
  getAlertById,
  getActiveAlertSummary,
};
