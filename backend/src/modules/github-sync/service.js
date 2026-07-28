const crypto = require('crypto');
const https = require('https');
const repo = require('./repository');

const SYNC_API_BASE = 'api.github.com';
const SYNC_USER_AGENT = 'InternOps-GitHub-Sync/1.0';

function getAppUrl() {
  const url = process.env.APP_URL;
  if (!url) {
    console.warn('APP_URL not set — webhook registration will use localhost');
    return 'http://localhost:5000';
  }
  return url.replace(/\/+$/, '');
}

function getWebhookSecret() {
  return process.env.GITHUB_WEBHOOK_SECRET || '';
}

let _ghToken = null;
function getGithubToken() {
  if (_ghToken) return _ghToken;
  if (process.env.GITHUB_TOKEN) {
    _ghToken = process.env.GITHUB_TOKEN;
    return _ghToken;
  }
  try {
    const { execSync } = require('child_process');
    _ghToken = execSync('gh auth token', {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    if (_ghToken) return _ghToken;
  } catch (_) {}
  return '';
}

function getDefaultRepo() {
  return process.env.GITHUB_DEFAULT_REPO || 'rajat-wyrm/InternOps';
}

function verifyWebhookSignature(payload, signatureHeader) {
  const secret = getWebhookSecret();
  if (!secret) {
    return false;
  }
  if (!signatureHeader) {
    return false;
  }
  const sig = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('hex');
  if (sig.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function extractPlatformFromLabels(labels) {
  if (!labels || labels.length === 0) return null;
  const platforms = ['LinkedIn', 'Instagram', 'Twitter', 'Facebook', 'YouTube'];
  for (const label of labels) {
    const name = label.name || label;
    for (const platform of platforms) {
      if (name.toLowerCase().includes(platform.toLowerCase())) {
        return platform;
      }
    }
  }
  return null;
}

function extractDeadlineFromLabels(labels) {
  if (!labels || labels.length === 0) return null;
  for (const label of labels) {
    const name = label.name || label;
    const dateMatch = name.match(/deadline[:\s]*(\d{4}-\d{2}-\d{2})/i);
    if (dateMatch) {
      return dateMatch[1];
    }
    const daysMatch = name.match(/due[:\s]*(\d+)\s*days/i);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      const date = new Date();
      date.setDate(date.getDate() + days);
      return date.toISOString();
    }
  }
  return null;
}

function truncateDescription(text, maxLength = 2000) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function buildTaskLink(issueUrl) {
  return issueUrl;
}

function determineEventAction(event, payload) {
  if (event === 'issues') {
    return payload.action || 'unknown';
  }
  if (event === 'ping') {
    return 'ping';
  }
  return event;
}

async function handleIssueOpened(payload) {
  const issue = payload.issue;
  const repository = payload.repository;
  const repoFullName = repository.full_name;
  const labels = issue.labels || [];

  const existingTask = await repo.findTaskByIssueId(issue.id);
  if (existingTask) {
    await repo.logSyncEvent({
      eventType: 'issues',
      action: 'opened',
      githubIssueId: issue.id,
      githubIssueNumber: issue.number,
      githubRepo: repoFullName,
      taskId: existingTask.id,
      status: 'skipped',
      message: `Issue #${issue.number} already synced as task ${existingTask.id}`,
      details: { existingTaskTitle: existingTask.title },
      triggeredBy: payload.sender?.login,
    });
    return { task: existingTask, action: 'skipped' };
  }

  const targetPlatform = extractPlatformFromLabels(labels);
  const deadline = extractDeadlineFromLabels(labels);
  const description = truncateDescription(
    `GitHub Issue #${issue.number} — ${issue.html_url}`
  );

  const adminUsers = await repo.getAdminUsers();
  const createdBy = adminUsers[0]?.id || null;

  const githubMetadata = {
    author: issue.user?.login || payload.sender?.login || 'unknown',
    authorAvatar: issue.user?.avatar_url || null,
    authorUrl: issue.user?.html_url || null,
    commentCount: issue.comments || 0,
    commentParticipants: [],
    labels: labels.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
    })),
  };

  const task = await repo.createTaskFromIssue({
    title: issue.title,
    description: description,
    targetPlatform: targetPlatform,
    taskLink: buildTaskLink(issue.html_url),
    deadline: deadline,
    createdBy: createdBy,
    githubIssueId: issue.id,
    githubIssueNumber: issue.number,
    githubRepo: repoFullName,
    githubIssueUrl: issue.html_url,
    githubLabels: githubMetadata,
  });

  if (issue.assignees && issue.assignees.length > 0) {
    for (const assignee of issue.assignees) {
      try {
        const matchedUser = await repo.findOrCreateAssignee(assignee);
        if (matchedUser && createdBy) {
          await repo.assignTaskToUser(task.id, matchedUser.id, createdBy);
        }
      } catch (err) {
        // assignment failure is non-critical
      }
    }
  } else if (createdBy && adminUsers.length > 0) {
    const firstAssignee =
      adminUsers.find((a) => a.id !== createdBy) || adminUsers[0];
    if (firstAssignee) {
      await repo.assignTaskToUser(task.id, firstAssignee.id, createdBy);
    }
  }

  await repo.logSyncEvent({
    eventType: 'issues',
    action: 'opened',
    githubIssueId: issue.id,
    githubIssueNumber: issue.number,
    githubRepo: repoFullName,
    taskId: task.id,
    status: 'success',
    message: `Created task from issue #${issue.number}: ${issue.title}`,
    details: {
      issueTitle: issue.title,
      issueUrl: issue.html_url,
      assignees: (issue.assignees || []).map((a) => a.login),
      labels: labels.map((l) => l.name),
    },
    triggeredBy: payload.sender?.login,
  });

  await repo.updateSyncTimestamp(1);

  try {
    const notificationsRepo = require('../../modules/notifications/repository');
    const notifiedUsers = new Set();
    const pool = require('../../config/db');
    if (issue.assignees && issue.assignees.length > 0) {
      for (const assignee of issue.assignees) {
        const matchedUser = await repo.findOrCreateAssignee(assignee);
        if (matchedUser && !notifiedUsers.has(matchedUser.id)) {
          notifiedUsers.add(matchedUser.id);
          await notificationsRepo.send(
            matchedUser.id,
            `🔗 GitHub Issue #${issue.number}: Task "${issue.title}" created. A new task was created from GitHub issue #${issue.number}. Click to view details.`
          );
        }
      }
    }
    const assignees = await pool.query(
      `SELECT ta.user_id FROM task_assignments ta WHERE ta.task_id = $1 AND ta.deleted_at IS NULL`,
      [task.id]
    );
    for (const row of assignees.rows) {
      if (!notifiedUsers.has(row.user_id)) {
        notifiedUsers.add(row.user_id);
        await notificationsRepo.send(
          row.user_id,
          `🔗 GitHub Issue #${issue.number}: A new task "${issue.title}" has been assigned to you.`
        );
      }
    }
  } catch (notifErr) {
    // notification failure is non-critical
  }

  return { task, action: 'created' };
}

async function handleIssueClosed(payload) {
  const issue = payload.issue;
  const repoFullName = payload.repository.full_name;

  const existingTask = await repo.findTaskByIssueId(issue.id);
  if (!existingTask) {
    await repo.logSyncEvent({
      eventType: 'issues',
      action: 'closed',
      githubIssueId: issue.id,
      githubIssueNumber: issue.number,
      githubRepo: repoFullName,
      status: 'skipped',
      message: `No task found for issue #${issue.number}`,
      triggeredBy: payload.sender?.login,
    });
    return { task: null, action: 'not_found' };
  }

  if (existingTask.deleted_at) {
    await repo.logSyncEvent({
      eventType: 'issues',
      action: 'closed',
      githubIssueId: issue.id,
      githubIssueNumber: issue.number,
      githubRepo: repoFullName,
      taskId: existingTask.id,
      status: 'skipped',
      message: `Task for issue #${issue.number} already closed`,
      triggeredBy: payload.sender?.login,
    });
    return { task: existingTask, action: 'already_closed' };
  }

  const closedTask = await repo.closeTaskByIssueId(issue.id);

  await repo.logSyncEvent({
    eventType: 'issues',
    action: 'closed',
    githubIssueId: issue.id,
    githubIssueNumber: issue.number,
    githubRepo: repoFullName,
    taskId: existingTask.id,
    status: 'success',
    message: `Closed task from issue #${issue.number}`,
    details: {
      taskTitle: existingTask.title,
      closedAt: issue.closed_at,
    },
    triggeredBy: payload.sender?.login,
  });

  return { task: closedTask, action: 'closed' };
}

async function handleIssueReopened(payload) {
  const issue = payload.issue;
  const repoFullName = payload.repository.full_name;

  const existingTask = await repo.findTaskByIssueId(issue.id);
  if (!existingTask) {
    const result = await handleIssueOpened(payload);
    return { ...result, action: 'created_from_reopen' };
  }

  if (!existingTask.deleted_at) {
    await repo.logSyncEvent({
      eventType: 'issues',
      action: 'reopened',
      githubIssueId: issue.id,
      githubIssueNumber: issue.number,
      githubRepo: repoFullName,
      taskId: existingTask.id,
      status: 'skipped',
      message: `Task for issue #${issue.number} is already active`,
      triggeredBy: payload.sender?.login,
    });
    return { task: existingTask, action: 'already_active' };
  }

  const reopenedTask = await repo.reopenTaskByIssueId(issue.id);

  const labels = issue.labels || [];
  await repo.updateTaskFromIssue(reopenedTask.id, {
    title: issue.title,
    description: truncateDescription(
      `GitHub Issue #${issue.number} — ${issue.html_url}`
    ),
    taskLink: issue.html_url,
    githubLabels: labels.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
    })),
  });

  await repo.logSyncEvent({
    eventType: 'issues',
    action: 'reopened',
    githubIssueId: issue.id,
    githubIssueNumber: issue.number,
    githubRepo: repoFullName,
    taskId: reopenedTask.id,
    status: 'success',
    message: `Reopened task from issue #${issue.number}`,
    details: {
      taskTitle: issue.title,
      reopenedAt: new Date().toISOString(),
    },
    triggeredBy: payload.sender?.login,
  });

  return { task: reopenedTask, action: 'reopened' };
}

async function handleIssueEdited(payload) {
  const issue = payload.issue;
  const repoFullName = payload.repository.full_name;

  const existingTask = await repo.findTaskByIssueId(issue.id);
  if (!existingTask) {
    await repo.logSyncEvent({
      eventType: 'issues',
      action: 'edited',
      githubIssueId: issue.id,
      githubIssueNumber: issue.number,
      githubRepo: repoFullName,
      status: 'skipped',
      message: `No task found for issue #${issue.number}, edit ignored`,
      triggeredBy: payload.sender?.login,
    });
    return { task: null, action: 'not_found' };
  }

  const labels = issue.labels || [];
  const targetPlatform = extractPlatformFromLabels(labels);

  const existingLabels =
    typeof existingTask.github_labels === 'object'
      ? existingTask.github_labels
      : {};
  const updatedLabels = {
    ...existingLabels,
    labels: labels.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
    })),
  };

  const updatedTask = await repo.updateTaskFromIssue(existingTask.id, {
    title: issue.title,
    description: truncateDescription(
      `GitHub Issue #${issue.number} — ${issue.html_url}`
    ),
    taskLink: issue.html_url,
    githubLabels: updatedLabels,
  });

  await repo.logSyncEvent({
    eventType: 'issues',
    action: 'edited',
    githubIssueId: issue.id,
    githubIssueNumber: issue.number,
    githubRepo: repoFullName,
    taskId: updatedTask.id,
    status: 'success',
    message: `Updated task from issue #${issue.number} edit`,
    details: {
      changes: {
        title: issue.title !== existingTask.title,
        description: !!payload.changes?.body,
        labels: labels.length > 0,
      },
    },
    triggeredBy: payload.sender?.login,
  });

  return { task: updatedTask, action: 'updated' };
}

async function handleIssueUnlabeled(payload) {
  const issue = payload.issue;
  const repoFullName = payload.repository.full_name;
  const existingTask = await repo.findTaskByIssueId(issue.id);
  if (!existingTask) {
    await repo.logSyncEvent({
      eventType: 'issues',
      action: 'unlabeled',
      githubIssueId: issue.id,
      githubIssueNumber: issue.number,
      githubRepo: repoFullName,
      status: 'skipped',
      message: `No task found for issue #${issue.number}`,
      triggeredBy: payload.sender?.login,
    });
    return { task: null, action: 'not_found' };
  }
  const labels = issue.labels || [];
  const existingMetadata =
    typeof existingTask.github_labels === 'object' && existingTask.github_labels
      ? existingTask.github_labels
      : {};
  await repo.updateTaskFromIssue(existingTask.id, {
    githubLabels: {
      ...existingMetadata,
      labels: labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
    },
  });
  const labelName = payload.label?.name || 'unknown';
  await repo.logSyncEvent({
    eventType: 'issues',
    action: 'unlabeled',
    githubIssueId: issue.id,
    githubIssueNumber: issue.number,
    githubRepo: repoFullName,
    taskId: existingTask.id,
    status: 'success',
    message: `Label "${labelName}" removed from issue #${issue.number}`,
    details: { removedLabel: labelName },
    triggeredBy: payload.sender?.login,
  });
  return { task: existingTask, action: 'unlabeled' };
}

async function handleIssueAssigned(payload) {
  const issue = payload.issue;
  const repoFullName = payload.repository.full_name;
  const existingTask = await repo.findTaskByIssueId(issue.id);
  if (!existingTask) {
    return { task: null, action: 'not_found' };
  }
  const assignee = payload.assignee;
  if (!assignee) return { task: existingTask, action: 'no_assignee' };
  const matchedUser = await repo.findOrCreateAssignee(assignee);
  if (matchedUser) {
    const adminUsers = await repo.getAdminUsers();
    const assignedBy = adminUsers[0]?.id || null;
    await repo.assignTaskToUser(existingTask.id, matchedUser.id, assignedBy);
  }
  await repo.logSyncEvent({
    eventType: 'issues',
    action: 'assigned',
    githubIssueId: issue.id,
    githubIssueNumber: issue.number,
    githubRepo: repoFullName,
    taskId: existingTask.id,
    status: 'success',
    message: `Issue #${issue.number} assigned to ${assignee.login}`,
    details: { assignee: assignee.login },
    triggeredBy: payload.sender?.login,
  });
  return { task: existingTask, action: 'assigned' };
}

async function handleIssueUnassigned(payload) {
  const issue = payload.issue;
  const repoFullName = payload.repository.full_name;
  const existingTask = await repo.findTaskByIssueId(issue.id);
  if (!existingTask) {
    return { task: null, action: 'not_found' };
  }
  await repo.logSyncEvent({
    eventType: 'issues',
    action: 'unassigned',
    githubIssueId: issue.id,
    githubIssueNumber: issue.number,
    githubRepo: repoFullName,
    taskId: existingTask.id,
    status: 'success',
    message: `Issue #${issue.number} unassigned`,
    details: { assignee: payload.assignee?.login || 'unknown' },
    triggeredBy: payload.sender?.login,
  });
  return { task: existingTask, action: 'unassigned' };
}

async function handleIssueMilestoned(payload) {
  const issue = payload.issue;
  const repoFullName = payload.repository.full_name;
  const existingTask = await repo.findTaskByIssueId(issue.id);
  if (!existingTask) {
    return { task: null, action: 'not_found' };
  }
  const milestone = payload.milestone || issue.milestone;
  if (milestone && milestone.due_on) {
    const pool = require('../../config/db');
    await pool.query(
      `UPDATE social_tasks SET deadline = $1, last_synced_at = NOW() WHERE id = $2`,
      [milestone.due_on, existingTask.id]
    );
  }
  await repo.logSyncEvent({
    eventType: 'issues',
    action: 'milestoned',
    githubIssueId: issue.id,
    githubIssueNumber: issue.number,
    githubRepo: repoFullName,
    taskId: existingTask.id,
    status: 'success',
    message: `Issue #${issue.number} added to milestone "${milestone?.title || 'unknown'}"`,
    details: { milestone: milestone?.title, dueOn: milestone?.due_on },
    triggeredBy: payload.sender?.login,
  });
  return { task: existingTask, action: 'milestoned' };
}

async function handleIssueDemilestoned(payload) {
  const issue = payload.issue;
  const repoFullName = payload.repository.full_name;
  const existingTask = await repo.findTaskByIssueId(issue.id);
  if (!existingTask) {
    return { task: null, action: 'not_found' };
  }
  await repo.logSyncEvent({
    eventType: 'issues',
    action: 'demilestoned',
    githubIssueId: issue.id,
    githubIssueNumber: issue.number,
    githubRepo: repoFullName,
    taskId: existingTask.id,
    status: 'success',
    message: `Issue #${issue.number} removed from milestone`,
    triggeredBy: payload.sender?.login,
  });
  return { task: existingTask, action: 'demilestoned' };
}

async function handleIssueLabeled(payload) {
  const issue = payload.issue;
  const repoFullName = payload.repository.full_name;

  const existingTask = await repo.findTaskByIssueId(issue.id);
  if (!existingTask) {
    await repo.logSyncEvent({
      eventType: 'issues',
      action: 'labeled',
      githubIssueId: issue.id,
      githubIssueNumber: issue.number,
      githubRepo: repoFullName,
      status: 'skipped',
      message: `No task found for issue #${issue.number}, label ignored`,
      triggeredBy: payload.sender?.login,
    });
    return { task: null, action: 'not_found' };
  }

  const labels = issue.labels || [];
  const targetPlatform = extractPlatformFromLabels(labels);
  const existingMetadata =
    typeof existingTask.github_labels === 'object' && existingTask.github_labels
      ? existingTask.github_labels
      : {};

  const updatedTask = await repo.updateTaskFromIssue(existingTask.id, {
    githubLabels: {
      ...existingMetadata,
      labels: labels.map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
      })),
    },
  });

  if (targetPlatform) {
    const pool = require('../../config/db');
    await pool.query(
      `UPDATE social_tasks SET target_platform = $1 WHERE id = $2`,
      [targetPlatform, existingTask.id]
    );
  }

  const labelName = payload.label?.name || 'unknown';

  await repo.logSyncEvent({
    eventType: 'issues',
    action: 'labeled',
    githubIssueId: issue.id,
    githubIssueNumber: issue.number,
    githubRepo: repoFullName,
    taskId: updatedTask.id,
    status: 'success',
    message: `Label "${labelName}" synced for issue #${issue.number}`,
    details: {
      label: labelName,
      platform: targetPlatform,
      allLabels: labels.map((l) => l.name),
    },
    triggeredBy: payload.sender?.login,
  });

  return { task: updatedTask, action: 'labeled' };
}

async function handlePingEvent(payload) {
  await repo.updatePingTimestamp();
  const repoFullName = payload.repository?.full_name || getDefaultRepo();
  const settings = await repo.getGithubSyncSettings();
  if (!settings) {
    await repo.upsertGithubSyncSettings({
      repo: repoFullName,
      isActive: true,
    });
  } else if (!settings.repo) {
    await repo.upsertGithubSyncSettings({
      repo: repoFullName,
    });
  }
  await repo.logSyncEvent({
    eventType: 'ping',
    action: 'ping',
    githubRepo: repoFullName,
    status: 'success',
    message: `Webhook registered successfully for ${repoFullName}`,
    details: {
      zen: payload.zen || '',
      hookId: payload.hook_id || null,
    },
    triggeredBy: payload.sender?.login || 'github',
  });
  return { action: 'ping_acknowledged', repo: repoFullName };
}

async function handleWebhookEvent(event, payload) {
  switch (event) {
    case 'ping':
      return await handlePingEvent(payload);
    case 'issues':
      switch (payload.action) {
        case 'opened':
          return await handleIssueOpened(payload);
        case 'closed':
          return await handleIssueClosed(payload);
        case 'reopened':
          return await handleIssueReopened(payload);
        case 'edited':
          return await handleIssueEdited(payload);
        case 'labeled':
          return await handleIssueLabeled(payload);
        case 'unlabeled':
          return await handleIssueUnlabeled(payload);
        case 'assigned':
          return await handleIssueAssigned(payload);
        case 'unassigned':
          return await handleIssueUnassigned(payload);
        case 'milestoned':
          return await handleIssueMilestoned(payload);
        case 'demilestoned':
          return await handleIssueDemilestoned(payload);
        default:
          await repo.logSyncEvent({
            eventType: 'issues',
            action: payload.action,
            githubIssueId: payload.issue?.id || null,
            githubIssueNumber: payload.issue?.number || null,
            githubRepo: payload.repository?.full_name || null,
            status: 'skipped',
            message: `Unhandled issue action: ${payload.action}`,
            triggeredBy: payload.sender?.login,
          });
          return { action: 'unhandled', event, issueAction: payload.action };
      }
    default:
      await repo.logSyncEvent({
        eventType: event,
        action: 'unhandled',
        githubRepo: payload.repository?.full_name || null,
        status: 'skipped',
        message: `Unhandled webhook event type: ${event}`,
        triggeredBy: payload.sender?.login,
      });
      return { action: 'unhandled', event };
  }
}

function githubApiRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const token = getGithubToken();
    const bodyStr = body
      ? typeof body === 'string'
        ? body
        : JSON.stringify(body)
      : null;
    const options = {
      hostname: SYNC_API_BASE,
      path: `/repos/${path}`,
      method,
      headers: {
        'User-Agent': SYNC_USER_AGENT,
        Accept: 'application/vnd.github.v3+json',
      },
      timeout: 30000,
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    if (bodyStr) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null,
            headers: res.headers,
          });
        } catch (e) {
          reject(new Error(`GitHub API parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('GitHub API request timed out'));
    });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function syncAllOpenIssues(repoFullName) {
  const targetRepo = repoFullName || getDefaultRepo();
  const results = {
    total: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    tasks: [],
  };

  let page = 1;
  let hasMore = true;

  while (hasMore) {
    let response;
    try {
      response = await githubApiRequest(
        `${targetRepo}/issues?state=open&per_page=100&page=${page}`
      );
    } catch (err) {
      results.failed++;
      results.errors.push(`GitHub API error on page ${page}: ${err.message}`);
      await repo.incrementFailedSyncs();
      await repo.logSyncEvent({
        eventType: 'sync_all',
        action: 'sync_all',
        githubRepo: targetRepo,
        status: 'failed',
        message: `Failed to fetch issues page ${page}: ${err.message}`,
        triggeredBy: 'system',
      });
      break;
    }

    if (response.status === 404) {
      results.errors.push(`Repository not found: ${targetRepo}`);
      await repo.logSyncEvent({
        eventType: 'sync_all',
        action: 'sync_all',
        githubRepo: targetRepo,
        status: 'failed',
        message: `Repository not found: ${targetRepo}`,
        triggeredBy: 'system',
      });
      break;
    }

    if (response.status === 401 || response.status === 403) {
      results.errors.push(`GitHub API auth error: ${response.status}`);
      await repo.logSyncEvent({
        eventType: 'sync_all',
        action: 'sync_all',
        githubRepo: targetRepo,
        status: 'failed',
        message: `GitHub API auth error: ${response.status}`,
        triggeredBy: 'system',
      });
      // For rate limiting, check headers
      if (response.headers?.['x-ratelimit-remaining'] === '0') {
        results.errors.push('Rate limit exceeded');
      }
      break;
    }

    const issues = response.data;
    if (!issues || !Array.isArray(issues) || issues.length === 0) {
      hasMore = false;
      break;
    }

    for (const issue of issues) {
      if (issue.pull_request) continue;
      results.total++;
      try {
        const payload = {
          action: 'opened',
          issue: issue,
          repository: { full_name: targetRepo },
          sender: { login: 'system-sync' },
        };
        const handlerResult = await handleIssueOpened(payload);
        if (handlerResult.action === 'created') {
          results.created++;
          results.tasks.push(handlerResult.task.id);
        } else {
          results.skipped++;
        }
      } catch (err) {
        results.failed++;
        results.errors.push(`Issue #${issue.number}: ${err.message}`);
        await repo.logSyncEvent({
          eventType: 'sync_all',
          action: 'sync_all',
          githubIssueId: issue.id,
          githubIssueNumber: issue.number,
          githubRepo: targetRepo,
          status: 'failed',
          message: `Failed to sync issue #${issue.number}: ${err.message}`,
          triggeredBy: 'system',
        });
      }
    }

    if (issues.length < 100) {
      hasMore = false;
    } else {
      page++;
    }
  }

  if (results.created > 0) {
    await repo.updateSyncTimestamp(results.created);
  }

  await repo.logSyncEvent({
    eventType: 'sync_all',
    action: 'sync_all',
    githubRepo: targetRepo,
    status: results.failed > 0 ? 'partial' : 'success',
    message: `Sync complete: ${results.created} created, ${results.skipped} skipped, ${results.failed} failed out of ${results.total}`,
    details: {
      total: results.total,
      created: results.created,
      skipped: results.skipped,
      failed: results.failed,
      errors: results.errors.slice(0, 10),
    },
    triggeredBy: 'system',
  });

  return results;
}

async function registerWebhook(repoFullName, webhookUrl, secret) {
  const token = getGithubToken();
  if (!token) {
    throw new Error('GITHUB_TOKEN is required to register webhook via API');
  }
  const targetUrl = webhookUrl || `${getAppUrl()}/api/v1/github/webhook`;
  const webhookSecret = secret || getWebhookSecret();
  if (!webhookSecret) {
    throw new Error('GITHUB_WEBHOOK_SECRET is required to register webhook');
  }
  const payload = JSON.stringify({
    name: 'web',
    active: true,
    events: ['issues'],
    config: {
      url: targetUrl,
      content_type: 'json',
      secret: webhookSecret,
      insecure_ssl: process.env.NODE_ENV === 'development' ? '1' : '0',
    },
  });
  return new Promise((resolve, reject) => {
    const https = require('https');
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${repoFullName}/hooks`,
      method: 'POST',
      headers: {
        'User-Agent': 'InternOps-GitHub-Sync/1.0',
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 30000,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 201) {
          try {
            resolve({
              success: true,
              hook: JSON.parse(data),
              status: res.statusCode,
            });
          } catch {
            resolve({ success: true, status: res.statusCode });
          }
        } else if (res.statusCode === 422) {
          try {
            const parsed = JSON.parse(data);
            if (
              parsed.errors?.some((e) => e.message?.includes('already exists'))
            ) {
              resolve({
                success: true,
                alreadyExists: true,
                message: 'Webhook already registered',
              });
            } else {
              reject(
                new Error(
                  `GitHub API validation error: ${parsed.message || JSON.stringify(parsed.errors)}`
                )
              );
            }
          } catch {
            reject(
              new Error(
                `Webhook registration failed with status ${res.statusCode}`
              )
            );
          }
        } else {
          reject(
            new Error(
              `GitHub API returned ${res.statusCode}: ${data.substring(0, 500)}`
            )
          );
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('GitHub API request timed out'));
    });
    req.write(payload);
    req.end();
  });
}

async function unregisterWebhook(repoFullName, hookId) {
  const token = getGithubToken();
  if (!token) throw new Error('GITHUB_TOKEN is required to unregister webhook');
  return new Promise((resolve, reject) => {
    const https = require('https');
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${repoFullName}/hooks/${hookId}`,
      method: 'DELETE',
      headers: {
        'User-Agent': 'InternOps-GitHub-Sync/1.0',
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      timeout: 15000,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 204) resolve({ success: true });
        else
          reject(
            new Error(
              `Failed to delete webhook: ${res.statusCode} ${data.substring(0, 200)}`
            )
          );
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.end();
  });
}

async function listWebhooks(repoFullName) {
  const token = getGithubToken();
  if (!token) throw new Error('GITHUB_TOKEN required');
  return new Promise((resolve, reject) => {
    const https = require('https');
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${repoFullName}/hooks`,
      method: 'GET',
      headers: {
        'User-Agent': 'InternOps-GitHub-Sync/1.0',
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      timeout: 15000,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode === 200)
            resolve({ success: true, hooks: JSON.parse(data) });
          else reject(new Error(`GitHub API returned ${res.statusCode}`));
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.end();
  });
}

async function getRateLimitStatus() {
  const token = getGithubToken();
  return new Promise((resolve) => {
    const https = require('https');
    const options = {
      hostname: 'api.github.com',
      path: '/rate_limit',
      method: 'GET',
      headers: {
        'User-Agent': 'InternOps-GitHub-Sync/1.0',
        Accept: 'application/vnd.github.v3+json',
      },
      timeout: 10000,
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const rate = parsed.rate || parsed.resources?.core;
          resolve({
            limit: rate?.limit || 60,
            remaining: rate?.remaining || 0,
            reset: rate?.reset
              ? new Date(rate.reset * 1000).toISOString()
              : null,
            used: rate?.used || 0,
          });
        } catch {
          resolve({ limit: 60, remaining: 0, error: 'parse failed' });
        }
      });
    });
    req.on('error', () =>
      resolve({ limit: 60, remaining: 0, error: 'request failed' })
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ limit: 60, remaining: 0, error: 'timeout' });
    });
    req.end();
  });
}

async function syncTaskToGithub(taskId, userId) {
  const task = await repo.getGithubTaskInfo(taskId);
  if (!task) throw new Error('Task not found');
  if (task.source !== 'github') throw new Error('Task is not GitHub-sourced');
  if (!task.github_issue_number || !task.github_repo)
    throw new Error('No GitHub issue reference');

  const token = getGithubToken();
  if (!token) throw new Error('GITHUB_TOKEN required for two-way sync');

  const issueRef = `${task.github_repo}/issues/${task.github_issue_number}`;
  const baseUrl = getAppUrl();
  const body = `Task synced from InternOps\n\n${task.description || ''}\n\n---\n🔗 InternOps Task: ${baseUrl}/tasks/${task.id}\n📅 Updated: ${new Date().toISOString()}`;

  const updates = {};
  if (task.title) updates.title = task.title;
  updates.body = body;

  const result = await githubApiRequest(issueRef, 'PATCH', updates);

  const success = result.status >= 200 && result.status < 300;
  const pool = require('../../config/db');
  await pool.query(
    `UPDATE social_tasks SET last_synced_at = NOW() WHERE id = $1`,
    [task.id]
  );

  await repo.logSyncEvent({
    eventType: 'two_way_sync',
    action: 'push_update',
    githubIssueNumber: task.github_issue_number,
    githubRepo: task.github_repo,
    taskId: task.id,
    status: success ? 'success' : 'failed',
    message: success
      ? `Pushed task update to GitHub issue #${task.github_issue_number}`
      : `Failed to push to GitHub issue #${task.github_issue_number}: HTTP ${result.status}`,
    details: {
      statusCode: result.status,
      updates: Object.keys(updates),
      issueRef,
    },
    triggeredBy: userId || 'system',
  });

  if (success) {
    try {
      await syncIssueComments(
        task.id,
        task.github_repo,
        task.github_issue_number
      );
    } catch {
      /* non-critical */
    }
  }

  return {
    success,
    task,
    githubResponse: result.data,
    statusCode: result.status,
  };
}

async function closeGithubIssueFromTask(taskId, userId) {
  const task = await repo.getGithubTaskInfo(taskId);
  if (
    !task ||
    task.source !== 'github' ||
    !task.github_issue_number ||
    !task.github_repo
  ) {
    return { success: false, reason: 'not_github_task' };
  }

  const token = getGithubToken();
  if (!token) return { success: false, reason: 'no_token' };

  const result = await githubApiRequest(
    `${task.github_repo}/issues/${task.github_issue_number}`,
    'PATCH',
    { state: 'closed', state_reason: 'not_planned' }
  );

  const success = result.status >= 200 && result.status < 300;

  await repo.logSyncEvent({
    eventType: 'two_way_sync',
    action: 'close_issue',
    githubIssueNumber: task.github_issue_number,
    githubRepo: task.github_repo,
    taskId: task.id,
    status: success ? 'success' : 'failed',
    message: success
      ? `Closed GitHub issue #${task.github_issue_number} from task deletion`
      : `Failed to close GitHub issue #${task.github_issue_number}: HTTP ${result.status}`,
    details: { statusCode: result.status },
    triggeredBy: userId || 'system',
  });

  return { success, githubResponse: result.data, statusCode: result.status };
}

async function reopenGithubIssueFromTask(taskId, userId) {
  const task = await repo.getGithubTaskInfo(taskId);
  if (
    !task ||
    task.source !== 'github' ||
    !task.github_issue_number ||
    !task.github_repo
  ) {
    return { success: false, reason: 'not_github_task' };
  }

  const token = getGithubToken();
  if (!token) return { success: false, reason: 'no_token' };

  const result = await githubApiRequest(
    `${task.github_repo}/issues/${task.github_issue_number}`,
    'PATCH',
    { state: 'open' }
  );

  const success = result.status >= 200 && result.status < 300;

  await repo.logSyncEvent({
    eventType: 'two_way_sync',
    action: 'reopen_issue',
    githubIssueNumber: task.github_issue_number,
    githubRepo: task.github_repo,
    taskId: task.id,
    status: success ? 'success' : 'failed',
    message: success
      ? `Reopened GitHub issue #${task.github_issue_number} from task restore`
      : `Failed to reopen GitHub issue #${task.github_issue_number}: HTTP ${result.status}`,
    details: { statusCode: result.status },
    triggeredBy: userId || 'system',
  });

  return { success, githubResponse: result.data, statusCode: result.status };
}

async function updateGithubIssueStatusBatch(taskIds, userId) {
  const results = [];
  for (const taskId of taskIds) {
    try {
      const result = await syncTaskToGithub(taskId, userId);
      results.push({
        taskId,
        success: result.success,
        statusCode: result.statusCode,
      });
    } catch (err) {
      results.push({ taskId, success: false, error: err.message });
    }
  }
  return {
    total: taskIds.length,
    synced: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

async function fetchIssueComments(repo, issueNumber) {
  const token = getGithubToken();
  if (!token) return { count: 0, participants: [] };
  try {
    const result = await githubApiRequest(
      `${repo}/issues/${issueNumber}/comments?per_page=100`
    );
    if (result.status === 200 && Array.isArray(result.data)) {
      const authors = [
        ...new Set(result.data.map((c) => c.user?.login).filter(Boolean)),
      ];
      return { count: result.data.length, participants: authors };
    }
    return { count: 0, participants: [] };
  } catch {
    return { count: 0, participants: [] };
  }
}

async function syncIssueComments(taskId, repo, issueNumber) {
  const comments = await fetchIssueComments(repo, issueNumber);
  if (comments.count > 0) {
    const pool = require('../../config/db');
    const existing = await pool.query(
      `SELECT github_labels FROM social_tasks WHERE id = $1`,
      [taskId]
    );
    const labels = existing.rows[0]?.github_labels || {};
    const updated = {
      ...(typeof labels === 'object' ? labels : {}),
      commentCount: comments.count,
      commentParticipants: comments.participants,
    };
    await pool.query(
      `UPDATE social_tasks SET github_labels = $1::jsonb, last_synced_at = NOW() WHERE id = $2`,
      [JSON.stringify(updated), taskId]
    );
  }
  return comments;
}

async function getTwoWaySyncLog(limit = 50) {
  const pool = require('../../config/db');
  const res = await pool.query(
    `SELECT * FROM github_sync_log
     WHERE event_type = 'two_way_sync'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

module.exports = {
  verifyWebhookSignature,
  handleWebhookEvent,
  syncAllOpenIssues,
  getWebhookSecret,
  getDefaultRepo,
  getGithubToken,
  registerWebhook,
  unregisterWebhook,
  listWebhooks,
  getRateLimitStatus,
  githubApiRequest,
  syncTaskToGithub,
  closeGithubIssueFromTask,
  reopenGithubIssueFromTask,
  updateGithubIssueStatusBatch,
  getTwoWaySyncLog,
  fetchIssueComments,
  syncIssueComments,
};
