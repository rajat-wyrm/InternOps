require('dotenv').config();
const validateEnv = require('./config/validateEnv');
validateEnv();

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Fastify = require('fastify');
const config = require('./config');
const pool = require('./config/db');
const metrics = require('./utils/metrics');
const { initializeWebSocket } = require('./websocket');
const noticesRoutes = require('./modules/notices/routes');

const app = Fastify({
  trustProxy: config.nodeEnv === 'production' ? true : 'loopback',
  logger:
    config.nodeEnv === 'development'
      ? { transport: { target: 'pino-pretty' } }
      : true,
  genReqId: () => uuidv4(),
});

app.register(require('@fastify/cors'), {
  origin: config.nodeEnv === 'production' ? config.corsOrigin : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
});

app.register(require('@fastify/helmet'), {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
});

//  Register once globally — no Redis dependency
app.register(require('@fastify/rate-limit'), {
  global: true,
  max: config.rateLimit.globalMax,
  timeWindow: config.rateLimit.timeWindow,
});

app.register(require('@fastify/cookie'));

const { csrfMiddleware } = require('./middleware/csrf');
app.addHook('onRequest', csrfMiddleware);

app.register(require('@fastify/multipart'), {
  limits: {
    fileSize: config.maxFileSize,
  },
});

app.register(require('@fastify/static'), {
  root: path.join(__dirname, '..', config.uploadDir),
  prefix: '/uploads/',
});

if (process.env.NODE_ENV !== 'test') {
  app.register(require('@fastify/swagger'), {
    openapi: {
      info: {
        title: 'InternOps API',
        version: '1.0.0',
      },
    },
  });

  app.register(require('@fastify/swagger-ui'), {
    routePrefix: '/docs',
  });
}

app.register(require('./modules/auth/routes'), {
  prefix: '/api/auth',
});

app.register(require('./modules/users/routes'), {
  prefix: '/api/users',
});

app.register(require('./modules/departments/routes'), {
  prefix: '/api/departments',
});

app.register(require('./modules/hierarchy/routes'), {
  prefix: '/api/hierarchy',
});

app.register(require('./modules/team/routes'), {
  prefix: '/api/team',
});

app.register(require('./modules/attendance/routes'), {
  prefix: '/api/attendance',
});

app.register(require('./modules/ratings/routes'), {
  prefix: '/api/ratings',
});

app.register(require('./modules/social-tasks/routes'), {
  prefix: '/api/tasks',
});

app.register(require('./modules/proof-submissions/routes'), {
  prefix: '/api/proofs',
});

app.register(require('./modules/notifications/routes'), {
  prefix: '/api/notifications',
});

app.register(require('./modules/audit/routes'), {
  prefix: '/api/audit',
});

app.register(require('./modules/uploads/routes'), {
  prefix: '/api/uploads',
});

app.register(require('./modules/analytics/routes'), {
  prefix: '/api/analytics',
});

app.register(require('./modules/meetings/routes'), {
  prefix: '/api/meetings',
});

app.register(require('./modules/sessions/routes'), {
  prefix: '/api/sessions',
});

app.register(require('./modules/reports/routes'), {
  prefix: '/api/reports',
});

app.register(require('./modules/reports/export'), {
  prefix: '/api/reports/export',
});

app.register(require('./modules/ai/routes'), {
  prefix: '/api/ai',
});

app.register(require('./modules/uptoskills/routes'), {
  prefix: '/api/uptoskills',
});

app.register(noticesRoutes);

app.get('/', async (req, reply) => {
  reply.redirect('/docs');
});

app.get('/fallback', async (req, reply) => {
  reply.type('text/html').send(`
    <html>
      <body style="font-family:sans-serif;padding:2em">
        <h1>InternOps API</h1>
        <a href="/docs">Swagger Docs</a>
      </body>
    </html>
  `);
});

app.get(
  '/metrics',
  {
    config: {
      rateLimit: false,
    },
  },
  metrics.metricsEndpoint
);

app.get(
  '/health',
  {
    config: {
      rateLimit: false,
    },
  },
  async (req, reply) => {
    const { getRedisStatus } = require('./config/redis');
    const redisStatus = getRedisStatus();

    if (process.env.NODE_ENV === 'test') {
      return reply.send({ status: 'ok' });
    }

    if (redisStatus === 'disconnected') {
      return reply
        .status(503)
        .send({ status: 'degraded', redis: 'disconnected' });
    }

    return reply.send({ status: 'ok' });
  }
);

app.get(
  '/health/db',
  {
    config: {
      rateLimit: false,
    },
  },
  async (req, reply) => {
    try {
      await pool.query('SELECT 1');
      reply.send({
        status: 'ok',
        db: 'connected',
      });
    } catch {
      reply.status(503).send({
        status: 'error',
        db: 'disconnected',
      });
    }
  }
);

app.get(
  '/health/full',
  {
    config: {
      rateLimit: false,
    },
  },
  async (req, reply) => {
    const checks = { db: false, redis: false };

    try {
      await pool.query('SELECT 1');
      checks.db = true;
    } catch {}

    const { getRedisStatus } = require('./config/redis');
    const redisStatus = getRedisStatus();

    checks.redis =
      process.env.NODE_ENV === 'test' ||
      redisStatus === 'connected' ||
      redisStatus === 'disabled';

    const healthy = checks.db && checks.redis;

    reply
      .status(healthy ? 200 : 503)
      .send({ status: healthy ? 'healthy' : 'degraded', checks });
  }
);

app.addHook('onRequest', metrics.trackActiveRequests);

app.addHook('onRequest', async (request) => {
  request.log.info(
    {
      reqId: request.id,
      method: request.method,
      url: request.url,
    },
    'incoming'
  );
});

app.addHook('onResponse', async (request) => {
  if (!request.auditOnResponse) return;

  const { createAuditLog } = require('./utils/audit');
  try {
    await createAuditLog(request.auditOnResponse);
  } catch (err) {
    request.log.error(
      { err, audit: request.auditOnResponse },
      'Failed to write deferred audit log'
    );
  }
});

app.setErrorHandler((error, request, reply) => {
  // Fastify AJV validation errors from schema.body / params / querystring.
  // These are safe to return as structured client-facing validation errors.
  if (error.validation) {
    request.log.warn(
      {
        statusCode: 400,
        message: error.message,
        validation: error.validation,
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query,
        userId: request.user?.id || null,
        role: request.user?.role || null,
      },
      'Validation error'
    );

    return reply.status(400).send({
      error: 'Validation error',
      details: error.validation.map((v) => ({
        path: v.instancePath || v.dataPath,
        message: v.message,
        keyword: v.keyword,
      })),
    });
  }

  // Zod validation errors.
  // Return validation details, but do not expose stack traces or internal debug info.
  if (error.name === 'ZodError' || Array.isArray(error.issues)) {
    request.log.warn(
      {
        statusCode: 400,
        message: error.message,
        issues: error.issues || [],
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query,
        userId: request.user?.id || null,
        role: request.user?.role || null,
      },
      'Zod validation error'
    );

    return reply.status(400).send({
      error: 'Validation error',
      details: error.issues || [],
    });
  }

  // Preserve safe messages for explicit HTTP/client errors and AppError instances.
  // Hide internal details for unexpected server errors.
  const statusCode = error.statusCode || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;
  const isOperational = error.isOperational === true;

  const clientMessage =
    isClientError || isOperational
      ? error.message || 'Request failed'
      : 'Internal Server Error';

  const logPayload = {
    statusCode,
    message: error.message,
    internalMessage: error.internalMessage || null,
    stack: error.stack,
    method: request.method,
    url: request.url,
    params: request.params,
    query: request.query,
    userId: request.user?.id || null,
    role: request.user?.role || null,
  };

  if (statusCode >= 500) {
    request.log.error(logPayload, 'Unhandled server error');
  } else {
    request.log.warn(logPayload, 'Request error');
  }

  return reply.status(statusCode).send({
    error: clientMessage,
  });
});

if (process.env.NODE_ENV !== 'test') {
  require('./utils/cron').setupCronJobs();
}

const start = async () => {
  try {
    await app.listen({
      port: config.port,
      host: config.host,
    });

    initializeWebSocket(app.server);

    console.log(`Server listening on port ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}, shutting down gracefully...`);

  try {
    // stop accepting new requests + finish in-flight requests
    await app.close();

    // close DB pool connections
    await pool.end();

    console.log('Cleanup completed. Exiting now.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  start();
} else {
  module.exports = app;
}
