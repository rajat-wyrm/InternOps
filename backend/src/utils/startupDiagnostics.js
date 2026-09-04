function sanitizeDatabaseTarget(connectionString) {
  try {
    const url = new URL(connectionString);
    const host = url.hostname || 'unknown';
    const database = url.pathname.replace(/^\//, '') || 'unknown';
    return {
      provider: host.endsWith('.neon.tech') ? 'Neon' : 'PostgreSQL',
      host,
      database,
      ssl: url.searchParams.has('sslmode') || url.searchParams.has('ssl'),
    };
  } catch {
    return {
      provider: 'PostgreSQL',
      host: 'configured',
      database: 'configured',
      ssl: false,
    };
  }
}

async function checkDatabase(pool, connectionString) {
  const target = sanitizeDatabaseTarget(connectionString);
  const result = await pool.query(
    "SELECT current_database() AS database, current_setting('ssl') AS ssl"
  );
  return {
    ...target,
    database: result.rows?.[0]?.database || target.database,
    ssl: result.rows?.[0]?.ssl === 'on' || target.ssl,
  };
}

function integrationStatus(config) {
  return {
    email: Boolean(
      config.email?.apiKey ||
      (config.email?.host && config.email?.user && config.email?.pass)
    ),
    ai: Boolean(
      config.ai?.fastapiUrl ||
      config.ai?.groqKey ||
      config.ai?.openaiKey ||
      config.ai?.geminiKey ||
      config.ai?.deepseekKey
    ),
    githubSync: process.env.GITHUB_ISSUE_SYNC === 'true',
    sentry: Boolean(config.sentry?.dsn),
  };
}

function writeStartupSummary({
  logger,
  database,
  redis,
  queue,
  integrations,
  port,
}) {
  logger.info('[STARTUP] Checking InternOps services...');
  logger.info(
    {
      provider: database.provider,
      database: database.database,
      host: database.host,
      ssl: database.ssl ? 'enabled' : 'disabled',
    },
    '[OK] PostgreSQL connected'
  );

  if (redis === 'connected') {
    logger.info('[OK] Redis connected');
  } else if (redis === 'disabled') {
    logger.warn('[WARN] Redis not configured; cache fallback is active');
  } else {
    logger.warn('[WARN] Redis unavailable; cache fallback is active');
  }

  const queueDetails = {
    mode: queue.mode,
    initialized: queue.initialized,
  };
  if (queue.mode === 'bullmq') {
    logger.info(queueDetails, '[OK] Bulk job queue initialized with BullMQ');
  } else {
    logger.warn(
      queueDetails,
      '[WARN] Bulk job queue is using direct execution'
    );
  }
  logger.info('[OK] WebSocket initialized');

  for (const [name, configured] of Object.entries(integrations)) {
    const label =
      name === 'githubSync'
        ? 'GitHub sync'
        : name === 'ai'
          ? 'AI service'
          : name.charAt(0).toUpperCase() + name.slice(1);
    if (configured) logger.info(`[OK] ${label} configured`);
    else logger.warn(`[WARN] ${label} not configured`);
  }

  logger.info({ port }, `[OK] Backend listening on http://localhost:${port}`);
  logger.info('[READY] InternOps backend is ready');
}

module.exports = {
  sanitizeDatabaseTarget,
  checkDatabase,
  integrationStatus,
  writeStartupSummary,
};
