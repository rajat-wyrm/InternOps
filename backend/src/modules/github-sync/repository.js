const pool = require('../../config/db');

async function findTaskByIssueId(githubIssueId) {
  const res = await pool.query(
    `SELECT * FROM social_tasks WHERE github_issue_id = $1 AND deleted_at IS NULL`,
    [githubIssueId]
  );
  return res.rows[0] || null;
}

async function createTaskFromIssue({
  title,
  description,
  targetPlatform,
  taskLink,
  deadline,
  createdBy,
  githubIssueId,
  githubIssueNumber,
  githubRepo,
  githubIssueUrl,
  githubLabels,
}) {
  const res = await pool.query(
    `INSERT INTO social_tasks
      (title, description, target_platform, task_link, deadline, created_by,
       github_issue_id, github_issue_number, github_repo, github_issue_url,
       source, github_labels, last_synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     RETURNING *`,
    [
      title,
      description,
      targetPlatform,
      taskLink,
      deadline,
      createdBy,
      githubIssueId,
      githubIssueNumber,
      githubRepo,
      githubIssueUrl,
      'github',
      JSON.stringify(githubLabels || []),
    ]
  );
  return res.rows[0];
}

async function updateTaskFromIssue(
  taskId,
  { title, description, taskLink, githubLabels }
) {
  const res = await pool.query(
    `UPDATE social_tasks
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         task_link = COALESCE($3, task_link),
         github_labels = COALESCE($4::jsonb, github_labels),
         last_synced_at = NOW()
     WHERE id = $5 AND deleted_at IS NULL
     RETURNING *`,
    [title, description, taskLink, JSON.stringify(githubLabels || []), taskId]
  );
  return res.rows[0] || null;
}

async function closeTaskByIssueId(githubIssueId) {
  const res = await pool.query(
    `UPDATE social_tasks
     SET deleted_at = NOW(), last_synced_at = NOW()
     WHERE github_issue_id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [githubIssueId]
  );
  return res.rows[0] || null;
}

async function reopenTaskByIssueId(githubIssueId) {
  const res = await pool.query(
    `UPDATE social_tasks
     SET deleted_at = NULL, last_synced_at = NOW()
     WHERE github_issue_id = $1 AND deleted_at IS NOT NULL
     RETURNING *`,
    [githubIssueId]
  );
  return res.rows[0] || null;
}

async function findUserByEmail(email) {
  if (!email) return null;
  const res = await pool.query(
    `SELECT id, email, full_name, role FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL`,
    [email]
  );
  return res.rows[0] || null;
}

async function findUserByGithubUsername(username) {
  if (!username) return null;
  const res = await pool.query(
    `SELECT id, email, full_name, role FROM users
     WHERE LOWER(full_name) LIKE LOWER($1) AND deleted_at IS NULL
     LIMIT 1`,
    [`%${username}%`]
  );
  return res.rows[0] || null;
}

async function getAdminUsers() {
  const res = await pool.query(
    `SELECT id, email, full_name FROM users WHERE role = 'ADMIN' AND deleted_at IS NULL LIMIT 5`
  );
  return res.rows;
}

async function findOrCreateAssignee(githubUser) {
  if (githubUser.email) {
    const user = await findUserByEmail(githubUser.email);
    if (user) return user;
  }
  const user = await findUserByGithubUsername(githubUser.login);
  if (user) return user;
  const admins = await getAdminUsers();
  return admins[0] || null;
}

async function assignTaskToUser(taskId, userId, assignedBy) {
  const existing = await pool.query(
    `SELECT id FROM task_assignments WHERE task_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [taskId, userId]
  );
  if (existing.rowCount > 0) return existing.rows[0];
  const res = await pool.query(
    `INSERT INTO task_assignments (task_id, user_id, assigned_by, source)
     VALUES ($1, $2, $3, 'github')
     RETURNING id`,
    [taskId, userId, assignedBy]
  );
  return res.rows[0];
}

async function getGithubSyncSettings() {
  const res = await pool.query(
    `SELECT * FROM github_sync_settings WHERE is_active = true LIMIT 1`
  );
  return res.rows[0] || null;
}

async function upsertGithubSyncSettings({
  repo,
  webhookSecret,
  githubToken,
  isActive,
}) {
  const existing = await getGithubSyncSettings();
  if (existing) {
    const res = await pool.query(
      `UPDATE github_sync_settings
       SET repo = COALESCE($1, repo),
           webhook_secret = COALESCE($2, webhook_secret),
           github_token = COALESCE($3, github_token),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [repo, webhookSecret, githubToken, isActive, existing.id]
    );
    return res.rows[0];
  }
  const res = await pool.query(
    `INSERT INTO github_sync_settings (repo, webhook_secret, github_token, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [repo, webhookSecret, githubToken, isActive ?? true]
  );
  return res.rows[0];
}

async function updatePingTimestamp() {
  await pool.query(
    `UPDATE github_sync_settings SET last_ping_at = NOW() WHERE is_active = true`
  );
}

async function updateSyncTimestamp(successCount) {
  await pool.query(
    `UPDATE github_sync_settings
     SET last_sync_at = NOW(),
         total_issues_synced = total_issues_synced + $1,
         updated_at = NOW()
     WHERE is_active = true`,
    [successCount]
  );
}

async function logSyncEvent({
  eventType,
  action,
  githubIssueId,
  githubIssueNumber,
  githubRepo,
  taskId,
  status,
  message,
  details,
  triggeredBy,
}) {
  const res = await pool.query(
    `INSERT INTO github_sync_log
      (event_type, action, github_issue_id, github_issue_number, github_repo,
       task_id, status, message, details, triggered_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      eventType,
      action,
      githubIssueId ?? null,
      githubIssueNumber ?? null,
      githubRepo ?? null,
      taskId ?? null,
      status,
      message ?? null,
      JSON.stringify(details || {}),
      triggeredBy ?? null,
    ]
  );
  return res.rows[0];
}

async function getRecentSyncLogs(limit = 50) {
  const res = await pool.query(
    `SELECT * FROM github_sync_log ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows;
}

async function getSyncStats() {
  const settings = await getGithubSyncSettings();
  const logCounts = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'success') AS successful,
       COUNT(*) FILTER (WHERE status = 'failed') AS failed,
       COUNT(*) FILTER (WHERE status = 'skipped') AS skipped
     FROM github_sync_log`
  );
  const totalTasks = await pool.query(
    `SELECT COUNT(*)::int AS count FROM social_tasks WHERE source = 'github' AND deleted_at IS NULL`
  );
  return {
    configured: !!settings,
    repo: settings?.repo || null,
    lastSyncAt: settings?.last_sync_at || null,
    lastPingAt: settings?.last_ping_at || null,
    totalSynced: totalTasks.rows[0]?.count || 0,
    successful: logCounts.rows[0]?.successful || 0,
    failed: logCounts.rows[0]?.failed || 0,
    skipped: logCounts.rows[0]?.skipped || 0,
  };
}

async function incrementFailedSyncs() {
  await pool.query(
    `UPDATE github_sync_settings SET failed_syncs = failed_syncs + 1, updated_at = NOW() WHERE is_active = true`
  );
}

async function getFailedSyncLogs(limit = 50) {
  const res = await pool.query(
    `SELECT * FROM github_sync_log
     WHERE status = 'failed'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

async function markSyncLogRetrying(id) {
  await pool.query(
    `UPDATE github_sync_log SET status = 'retrying', details = jsonb_set(COALESCE(details, '{}'::jsonb), '{retried_at}', to_jsonb($1::text)) WHERE id = $2`,
    [new Date().toISOString(), id]
  );
}

async function markSyncLogResolved(id, resolutionStatus, resolutionMessage) {
  await pool.query(
    `UPDATE github_sync_log
     SET status = $1, message = COALESCE($2, message),
         details = details || jsonb_build_object('resolved_at', $3::text)
     WHERE id = $4`,
    [resolutionStatus, resolutionMessage || null, new Date().toISOString(), id]
  );
}

async function countPendingRetries() {
  const res = await pool.query(
    `SELECT COUNT(*)::int AS count FROM github_sync_log WHERE status IN ('failed', 'retrying')`
  );
  return res.rows[0]?.count || 0;
}

async function getSyncLogsByIssue(githubIssueId) {
  const res = await pool.query(
    `SELECT * FROM github_sync_log WHERE github_issue_id = $1 ORDER BY created_at DESC`,
    [githubIssueId]
  );
  return res.rows;
}

async function deleteSyncLogsOlderThan(days = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const res = await pool.query(
    `DELETE FROM github_sync_log WHERE created_at < $1`,
    [cutoff]
  );
  return res.rowCount;
}

async function getAllSyncedIssues(page = 1, limit = 50) {
  const safeLimit = Math.min(Number(limit) || 50, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * safeLimit;
  const [tasksRes, countRes] = await Promise.all([
    pool.query(
      `SELECT id, title, github_issue_number, github_issue_url, github_repo,
              github_labels, source, created_at, last_synced_at, status
       FROM social_tasks
       WHERE source = 'github' AND deleted_at IS NULL
       ORDER BY last_synced_at DESC NULLS LAST, created_at DESC
       LIMIT $1 OFFSET $2`,
      [safeLimit, offset]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM social_tasks WHERE source = 'github' AND deleted_at IS NULL`
    ),
  ]);
  return {
    tasks: tasksRes.rows,
    total: countRes.rows[0]?.count || 0,
    page,
    limit: safeLimit,
  };
}

async function getWebhookRegistration(id) {
  const res = await pool.query(
    `SELECT * FROM github_sync_settings WHERE id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

async function getGithubTaskInfo(taskId) {
  const res = await pool.query(
    `SELECT id, title, description, source, github_issue_id, github_issue_number,
            github_repo, github_issue_url, github_labels, created_by, deleted_at,
            target_platform, task_link, deadline, last_synced_at
     FROM social_tasks
     WHERE id = $1`,
    [taskId]
  );
  return res.rows[0] || null;
}

async function getSyncAnalytics(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const [
    dailyCounts,
    eventDistribution,
    statusDistribution,
    topRepos,
    syncRate,
  ] = await Promise.all([
    pool.query(
      `SELECT DATE(created_at) AS date, COUNT(*)::int AS count
       FROM github_sync_log WHERE created_at >= $1
       GROUP BY DATE(created_at) ORDER BY date`,
      [cutoff]
    ),
    pool.query(
      `SELECT event_type, COUNT(*)::int AS count
       FROM github_sync_log WHERE created_at >= $1
       GROUP BY event_type ORDER BY count DESC`,
      [cutoff]
    ),
    pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM github_sync_log WHERE created_at >= $1
       GROUP BY status ORDER BY count DESC`,
      [cutoff]
    ),
    pool.query(
      `SELECT github_repo, COUNT(*)::int AS count
       FROM social_tasks WHERE source = 'github' AND deleted_at IS NULL
       GROUP BY github_repo ORDER BY count DESC LIMIT 10`
    ),
    pool.query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'success')::int AS successful,
        ROUND(COUNT(*) FILTER (WHERE status = 'success')::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS success_rate
       FROM github_sync_log WHERE created_at >= $1`,
      [cutoff]
    ),
  ]);

  return {
    dailyCounts: dailyCounts.rows,
    eventDistribution: eventDistribution.rows,
    statusDistribution: statusDistribution.rows,
    topRepos: topRepos.rows,
    syncRate: syncRate.rows[0] || { total: 0, successful: 0, successRate: 0 },
    periodDays: days,
  };
}

module.exports = {
  findTaskByIssueId,
  createTaskFromIssue,
  updateTaskFromIssue,
  closeTaskByIssueId,
  reopenTaskByIssueId,
  findUserByEmail,
  findUserByGithubUsername,
  findOrCreateAssignee,
  assignTaskToUser,
  getAdminUsers,
  getGithubSyncSettings,
  upsertGithubSyncSettings,
  updatePingTimestamp,
  updateSyncTimestamp,
  logSyncEvent,
  getRecentSyncLogs,
  getSyncStats,
  incrementFailedSyncs,
  getFailedSyncLogs,
  markSyncLogRetrying,
  markSyncLogResolved,
  countPendingRetries,
  getSyncLogsByIssue,
  deleteSyncLogsOlderThan,
  getAllSyncedIssues,
  getWebhookRegistration,
  getGithubTaskInfo,
  getSyncAnalytics,
};
