require('dotenv').config();
const validateEnv = require('./config/validateEnv');
validateEnv();
const auth = require('./middleware/auth');
const rbac = require('./middleware/rbac');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Fastify = require('fastify');
const config = require('./config');
const pool = require('./config/db');
const metrics = require('./utils/metrics');
const { initializeWebSocket, getIO } = require('./websocket');
const noticesRoutes = require('./modules/notices/routes');
const { getRedisStatus } = require('./config/redis');
const { csrfMiddleware } = require('./middleware/csrf');
const { sanitizationMiddleware } = require('./middleware/sanitize');
const { createAuditLog } = require('./utils/audit');
const { setupCronJobs } = require('./utils/cron');
const githubSyncOrchestrator = require('./modules/github-sync/orchestrator');

const app = Fastify({
  trustProxy: config.nodeEnv === 'production' ? true : 'loopback',
  logger:
    config.nodeEnv === 'development'
      ? {
          transport: { target: 'pino-pretty' },
          level: process.env.LOG_LEVEL || 'info',
        }
      : { level: process.env.LOG_LEVEL || 'info' },
  bodyLimit: 1048576,
  genReqId: () => uuidv4(),
});

// Layer 1: Register monitoring routes BEFORE global middleware to ensure observability
app.get(
  '/metrics',
  {
    preHandler: [auth, rbac('ADMIN')],
    config: {
      rateLimit: false,
    },
    preHandler: async (req, reply) => {
      const authHeader = req.headers['authorization'];
      const expectedToken = `Bearer ${process.env.METRICS_TOKEN}`;
      if (authHeader !== expectedToken) {
        return reply.status(404).send();
      }
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

app.register(require('@fastify/cors'), {
  origin: (origin, cb) => {
    if (config.nodeEnv !== 'production') {
      if (
        !origin ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
      ) {
        return cb(null, true);
      }
    }

    const configured = Array.isArray(config.corsOrigin)
      ? config.corsOrigin
      : typeof config.corsOrigin === 'string' && config.corsOrigin.includes(',')
        ? config.corsOrigin.split(',').map((o) => o.trim())
        : [config.corsOrigin];

    if (!origin || configured.includes(origin)) {
      return cb(null, true);
    }

    const corsError = new Error('Not allowed by CORS');
    corsError.statusCode = 403;
    return cb(corsError, false);
  },
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

app.register(require('@fastify/compress'), {
  global: true,
  encodings: ['gzip', 'deflate', 'br'],
});

app.register(require('@fastify/rate-limit'), {
  global: true,
  max: config.rateLimit.globalMax,
  timeWindow: config.rateLimit.timeWindow,
});

app.register(require('@fastify/cookie'));
app.addHook('preHandler', async (request, reply) => {
  const path = request.routerPath ?? request.routeOptions?.url;
  if (path === '/api/v1/auth/logout') return;

  return csrfMiddleware(request, reply);
});

app.addHook('preHandler', sanitizationMiddleware);

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
        description:
          'All business routes are versioned under /api/v1/. Future breaking changes will be introduced under /api/v2/ alongside the existing version.',
      },
      servers: [
        { url: '/api/v1', description: 'Current stable API (v1)' },
        {
          url: '/api/v2',
          description:
            'Next API version (v2) — see CONTRIBUTING.md for migration guide',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
  });

  const authMiddleware = require('./middleware/auth');

  app.register(require('@fastify/swagger-ui'), {
    routePrefix: '/api-docs',
    uiHooks: {
      onRequest: function (request, reply, next) {
        authMiddleware(request, reply)
          .then(() => {
            if (!reply.sent) {
              rbac('ADMIN')(request, reply, next);
            }
          })
          .catch(next);
      },
    },
  });

  app.addHook('onRoute', (routeOptions) => {
    if (!routeOptions.url.startsWith('/api/')) return;

    routeOptions.schema = routeOptions.schema || {};
    if (!routeOptions.schema.response) {
      routeOptions.schema.response = {
        200: {
          description: 'Successful response',
        },
        400: {
          description: 'Validation error',
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        500: {
          description: 'Internal Server Error',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      };
    }
  });
}

app.register(require('./routes'), { prefix: '/api/v1' });
app.register(require('./routes.v2'), { prefix: '/api/v2' });

app.get('/', async (req, reply) => {
  reply.redirect('/api-docs');
});

app.get('/fallback', async (req, reply) => {
  reply.type('text/html').send(`
    <html>
      <body style="font-family:sans-serif;padding:2em">
        <h1>InternOps API</h1>
        <a href="/api-docs">Swagger Docs</a>
      </body>
    </html>
  `);
});

app.addHook('onRequest', metrics.trackActiveRequests);

app.addHook('onRequest', async (request) => {
  request.startTime = Date.now();
});

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

app.addHook('onResponse', async (request, reply) => {
  metrics.observeHttpRequest(request, reply, request.startTime);

  if (!request?.auditOnResponse) return;
  if (reply.statusCode >= 200 && reply.statusCode < 300) {
    try {
      await createAuditLog(request.auditOnResponse);
    } catch (err) {
      request.log.error(
        { err, audit: request.auditOnResponse },
        'Failed to write deferred audit log'
      );
    }
  }
});

app.setErrorHandler((error, request, reply) => {
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
  setupCronJobs();
  githubSyncOrchestrator.initialize();
}

const start = async () => {
  try {
    await app.listen({
      port: config.port,
      host: config.host,
    });
    initializeWebSocket(app.server, app.log);
    app.log.info(
      { port: config.port },
      `Server listening on port ${config.port}`
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const SHUTDOWN_TIMEOUT = 20000;

const gracefulShutdown = async (signal) => {
  app.log.info({ signal }, `Received ${signal}, shutting down gracefully...`);

  const forceShutdown = setTimeout(() => {
    console.error('Shutdown timed out. Forcing exit.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    await app.close();

    try {
      const io = getIO();
      if (io) {
        app.log.info('Closing WebSocket server...');
        await new Promise((resolve) => io.close(resolve));
        app.log.info('WebSocket server closed');
      }
    } catch (wsErr) {
      app.log.warn({ err: wsErr }, 'Error closing WebSocket server');
    }

    await pool.end();

    try {
      githubSyncOrchestrator.shutdown();
    } catch (syncErr) {
      app.log.warn({ err: syncErr }, 'Error shutting down GitHub sync');
    }

    clearTimeout(forceShutdown);
    app.log.info('Cleanup completed. Exiting now.');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  } catch (err) {
    app.log.error({ err }, 'Error during shutdown');
    clearTimeout(forceShutdown);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  start();
} else {
  module.exports = app;
}
