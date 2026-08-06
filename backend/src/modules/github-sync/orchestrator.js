const repo = require('./repository');
const service = require('./service');
const { isEnabled } = require('../feature-flags/service');
const logger = require('../../logger');

let startupSyncDone = false;
let periodicSyncTimer = null;
let retryTimer = null;
let isSyncing = false;
let isRetrying = false;

const STARTUP_SYNC_DELAY_MS = 10_000;
const PERIODIC_SYNC_INTERVAL_MS = 30 * 60 * 1000;
const RETRY_INTERVAL_MS = 5 * 60 * 1000;
const MAX_RETRY_EVENTS = 50;

async function shouldRun() {
  try {
    return await isEnabled('GITHUB_ISSUE_SYNC');
  } catch {
    return false;
  }
}

async function triggerStartupSync() {
  if (startupSyncDone) return;
  const enabled = await shouldRun();
  if (!enabled) {
    logger.info('GitHub sync disabled via feature flag, skipping startup sync');
    startupSyncDone = true;
    return;
  }
  const settings = await repo.getGithubSyncSettings();
  if (!settings || !settings.is_active) {
    logger.info('GitHub sync not configured, skipping startup sync');
    startupSyncDone = true;
    return;
  }
  const token = service.getGithubToken();
  if (!token) {
    logger.warn(
      'No GITHUB_TOKEN configured, startup sync will only work for public repos'
    );
  }
  logger.info(
    { repo: settings.repo },
    'Starting initial GitHub sync (delayed 10s after boot)'
  );
  setTimeout(async () => {
    try {
      const results = await service.syncAllOpenIssues(settings.repo);
      logger.info({ results }, 'Startup GitHub sync completed');
      startupSyncDone = true;
    } catch (err) {
      logger.error({ err }, 'Startup GitHub sync failed');
      startupSyncDone = true;
    }
  }, STARTUP_SYNC_DELAY_MS);
}

async function runPeriodicSync() {
  if (isSyncing) return;
  const enabled = await shouldRun();
  if (!enabled) return;
  const settings = await repo.getGithubSyncSettings();
  if (!settings || !settings.is_active) return;
  isSyncing = true;
  const startTime = Date.now();
  logger.info('Starting periodic GitHub sync');
  try {
    const results = await service.syncAllOpenIssues(settings.repo);
    logger.info(
      { results, durationMs: Date.now() - startTime },
      'Periodic GitHub sync completed'
    );
  } catch (err) {
    logger.error(
      { err, durationMs: Date.now() - startTime },
      'Periodic GitHub sync failed'
    );
    await repo.incrementFailedSyncs();
  } finally {
    isSyncing = false;
  }
}

async function retryFailedSyncs() {
  if (isRetrying) return;
  const enabled = await shouldRun();
  if (!enabled) return;
  isRetrying = true;
  try {
    const failedLogs = await repo.getFailedSyncLogs(MAX_RETRY_EVENTS);
    if (failedLogs.length === 0) {
      isRetrying = false;
      return;
    }
    logger.info(
      { count: failedLogs.length },
      'Retrying failed GitHub sync events'
    );
    for (const log of failedLogs) {
      try {
        await repo.markSyncLogRetrying(log.id);
        const settings = await repo.getGithubSyncSettings();
        if (!settings || !settings.repo) continue;
        if (log.event_type === 'issues' && log.github_issue_number) {
          const response = await service.githubApiRequest(
            `${log.github_repo || settings.repo}/issues/${log.github_issue_number}`
          );
          if (response.status === 200 && response.data) {
            const issue = response.data;
            if (issue.pull_request) continue;
            const payload = {
              action: issue.state === 'closed' ? 'closed' : 'opened',
              issue: issue,
              repository: { full_name: log.github_repo || settings.repo },
              sender: { login: 'retry-system' },
            };
            await service.handleWebhookEvent('issues', payload);
            await repo.markSyncLogResolved(log.id, 'retry_success');
          } else if (response.status === 404) {
            await repo.markSyncLogResolved(log.id, 'issue_deleted');
          } else {
            await repo.markSyncLogResolved(
              log.id,
              'retry_failed',
              `HTTP ${response.status}`
            );
          }
        } else {
          await repo.markSyncLogResolved(
            log.id,
            'cannot_retry',
            'Non-issue event, manual review needed'
          );
        }
      } catch (err) {
        logger.error({ err, logId: log.id }, 'Failed to retry sync event');
        try {
          await repo.markSyncLogResolved(log.id, 'retry_error', err.message);
        } catch (err2) {
          logger.error(
            { err: err2, logId: log.id },
            'Failed to mark retry resolution'
          );
        }
      }
    }
    logger.info({ retried: failedLogs.length }, 'Retry pass completed');
  } catch (err) {
    logger.error({ err }, 'Retry cycle failed');
  } finally {
    isRetrying = false;
  }
}

function startPeriodicSync() {
  if (periodicSyncTimer) {
    clearInterval(periodicSyncTimer);
  }
  periodicSyncTimer = setInterval(runPeriodicSync, PERIODIC_SYNC_INTERVAL_MS);
  periodicSyncTimer.unref();
  logger.info(
    { intervalMs: PERIODIC_SYNC_INTERVAL_MS },
    'Periodic GitHub sync timer started'
  );
}

function startRetryCycle() {
  if (retryTimer) {
    clearInterval(retryTimer);
  }
  retryTimer = setInterval(retryFailedSyncs, RETRY_INTERVAL_MS);
  retryTimer.unref();
  logger.info(
    { intervalMs: RETRY_INTERVAL_MS },
    'GitHub sync retry cycle started'
  );
}

async function initialize() {
  const enabled = await shouldRun();
  if (!enabled) {
    logger.info('GITHUB_ISSUE_SYNC disabled — sync orchestrator not starting');
    return;
  }
  const settings = await repo.getGithubSyncSettings();
  if (!settings || !settings.is_active) {
    logger.info(
      'GitHub sync not configured — orchestrator idle, waiting for config'
    );
  }
  triggerStartupSync();
  startPeriodicSync();
  startRetryCycle();
  logger.info('GitHub sync orchestrator initialized');
}

function shutdown() {
  if (periodicSyncTimer) {
    clearInterval(periodicSyncTimer);
    periodicSyncTimer = null;
  }
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
  logger.info('GitHub sync orchestrator shut down');
}

async function getOrchestratorStatus() {
  const enabled = await shouldRun();
  const settings = await repo.getGithubSyncSettings();
  const stats = await repo.getSyncStats();
  const pendingRetries = await repo.countPendingRetries();
  return {
    enabled,
    configured: !!settings,
    repo: settings?.repo || null,
    isActive: settings?.is_active || false,
    startupSyncDone,
    isSyncing,
    isRetrying,
    periodicSyncIntervalMs: PERIODIC_SYNC_INTERVAL_MS,
    retryIntervalMs: RETRY_INTERVAL_MS,
    pendingRetries,
    totalSynced: stats.totalSynced,
    lastSyncAt: stats.lastSyncAt,
    lastPingAt: stats.lastPingAt,
  };
}

module.exports = {
  initialize,
  shutdown,
  triggerStartupSync,
  runPeriodicSync,
  retryFailedSyncs,
  getOrchestratorStatus,
};
