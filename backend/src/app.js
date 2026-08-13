require('dotenv').config();

const validateEnv = require('./config/validateEnv');
validateEnv();

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Fastify = require('fastify');

const config = require('./config');
const pool = require('./config/db');
const metrics = require('./utils/metrics');

const { initializeWebSocket, getIO } = require('./websocket');

const noticesRoutes = require('./modules/notices/routes');

const {
  getRedisStatus,
  initializeRedis,
  closeRedis,
} = require('./config/redis');

const authenticate = require('./middleware/auth');
const rbac = require('./middleware/rbac');
const { csrfMiddleware } = require('./middleware/csrf');
const { sanitizationMiddleware } = require('./middleware/sanitize');
const { createAuditLog } = require('./utils/audit');
const { setupCronJobs } = require('./utils/cron');

const app = Fastify({
  trustProxy: config.nodeEnv === 'production' ? true : 'loopback',

  logger:
    config.nodeEnv === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
          },
          level: process.env.LOG_LEVEL || 'info',
        }
      : {
          level: process.env.LOG_LEVEL || 'info',
        },

  bodyLimit: 1048576,

  genReqId: () => uuidv4(),
});

/*
|--------------------------------------------------------------------------
| Monitoring Routes
|--------------------------------------------------------------------------
| These routes are registered before global middleware so that
| observability endpoints remain available even when other services
| are degraded.
|--------------------------------------------------------------------------
*/

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
    const redisStatus = getRedisStatus();

    // Tests should always receive a simple healthy response.
    if (process.env.NODE_ENV === 'test') {
      return reply.send({
        status: 'ok',
      });
    }

    /*
     * Redis is optional.
     *
     * Therefore Redis being disabled should NOT make the
     * application unhealthy.
     *
     * Redis being configured but disconnected means the
     * application is running in degraded mode.
     */
    if (redisStatus === 'disconnected') {
      return reply.status(503).send({
        status: 'degraded',
        redis: redisStatus,
      });
    }

    return reply.send({
      status: 'ok',
      redis: redisStatus,
    });
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

      return reply.send({
        status: 'ok',
        db: 'connected',
      });
    } catch {
      return reply.status(503).send({
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
    const checks = {
      db: false,
      redis: false,
    };

    // Database check
    try {
      await pool.query('SELECT 1');
      checks.db = true;
    } catch {}

    // Redis check
    const redisStatus = getRedisStatus();

    /*
     * Redis is optional.
     *
     * These states are considered acceptable:
     * - connected
     * - disabled
     *
     * Only configured-but-unavailable Redis is degraded.
     */
    checks.redis =
      process.env.NODE_ENV === 'test' ||
      redisStatus === 'connected' ||
      redisStatus === 'disabled';

    const healthy = checks.db && checks.redis;

    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? 'healthy' : 'degraded',

      checks,

      redisStatus,
    });
  }
);

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

app.register(require('@fastify/cors'), {
  origin: (origin, cb) => {
    // Development: allow localhost / 127.0.0.1
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

    return cb(new Error('Not allowed by CORS'), false);
  },

  credentials: true,

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],

  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
});

/*
|--------------------------------------------------------------------------
| Security
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Compression
|--------------------------------------------------------------------------
*/

app.register(require('@fastify/compress'), {
  global: true,
  encodings: ['gzip', 'deflate', 'br'],
});

/*
|--------------------------------------------------------------------------
| Rate Limiting
|--------------------------------------------------------------------------
|
| IMPORTANT:
| The current rate limiter is intentionally left unchanged here.
|
| It currently uses Fastify's default in-memory store.
| We will modify this separately after app.js.
|
*/

app.register(require('@fastify/rate-limit'), {
  global: true,
  max: config.rateLimit.globalMax,
  timeWindow: config.rateLimit.timeWindow,
});

/*
|--------------------------------------------------------------------------
| Cookies
|--------------------------------------------------------------------------
*/

app.register(require('@fastify/cookie'));

/*
|--------------------------------------------------------------------------
| CSRF
|--------------------------------------------------------------------------
*/

app.addHook('preHandler', async (request, reply) => {
  const routePath = request.routerPath ?? request.routeOptions?.url;

  if (routePath === '/api/v1/auth/logout') {
    return;
  }

  return csrfMiddleware(request, reply);
});

/*
|--------------------------------------------------------------------------
| Sanitization
|--------------------------------------------------------------------------
*/

app.addHook('preHandler', sanitizationMiddleware);

/*
|--------------------------------------------------------------------------
| Multipart
|--------------------------------------------------------------------------
*/

app.register(require('@fastify/multipart'), {
  limits: {
    fileSize: config.maxFileSize,
  },
});

/*
|--------------------------------------------------------------------------
| Static Files
|--------------------------------------------------------------------------
*/

app.register(require('@fastify/static'), {
  root: path.join(__dirname, '..', config.uploadDir),

  prefix: '/uploads/',
});

/*
|--------------------------------------------------------------------------
| Swagger
|--------------------------------------------------------------------------
*/

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
        {
          url: '/api/v1',
          description: 'Current stable API (v1)',
        },

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

  const rbac = require('./middleware/rbac');

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

  /*
  |--------------------------------------------------------------------------
  | Route Schema Defaults
  |--------------------------------------------------------------------------
  */

  app.addHook('onRoute', (routeOptions) => {
    if (!routeOptions.url.startsWith('/api/')) {
      return;
    }

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
            error: {
              type: 'string',
            },

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

          properties: {
            error: {
              type: 'string',
            },
          },
        },

        500: {
          description: 'Internal Server Error',

          type: 'object',

          properties: {
            error: {
              type: 'string',
            },
          },
        },
      };
    }
  });
}

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

app.register(require('./routes'), {
  prefix: '/api/v1',
});

app.register(require('./routes.v2'), {
  prefix: '/api/v2',
});

/*
|--------------------------------------------------------------------------
| Root / Fallback
|--------------------------------------------------------------------------
*/

app.get('/', async (req, reply) => {
  return reply.redirect('/api-docs');
});

app.get('/fallback', async (req, reply) => {
  return reply.type('text/html').send(`
        <html>
          <body style="font-family:sans-serif;padding:2em">
            <h1>InternOps API</h1>
            <a href="/api-docs">Swagger Docs</a>
          </body>
        </html>
      `);
});

/*
|--------------------------------------------------------------------------
| Monitoring Hooks
|--------------------------------------------------------------------------
*/

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

  if (!request?.auditOnResponse) {
    return;
  }

  /*
   * Only emit audit log for successful
   * 2xx responses.
   */
  if (reply.statusCode >= 200 && reply.statusCode < 300) {
    try {
      await createAuditLog(request.auditOnResponse);
    } catch (err) {
      request.log.error(
        {
          err,
          audit: request.auditOnResponse,
        },
        'Failed to write deferred audit log'
      );
    }
  }
});

/*
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
*/

app.setErrorHandler((error, request, reply) => {
  /*
   * Fastify AJV validation errors.
   */
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

  /*
   * Zod validation errors.
   */
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

  /*
   * Preserve safe client-facing errors.
   */
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

/*
|--------------------------------------------------------------------------
| Cron Jobs
|--------------------------------------------------------------------------
*/

if (process.env.NODE_ENV !== 'test') {
  setupCronJobs();
}

/*
|--------------------------------------------------------------------------
| Application Startup
|--------------------------------------------------------------------------
*/

const start = async () => {
  try {
    /*
     * ---------------------------------------------------------------
     * Redis initialization
     * ---------------------------------------------------------------
     *
     * Redis is OPTIONAL.
     *
     * We initialize it before the server starts so that all
     * Redis-dependent modules can know whether Redis is available.
     */
    const redisResult = await initializeRedis();

    /*
     * Redis connected successfully.
     */
    if (redisResult.available) {
      app.log.info(
        {
          redisStatus: redisResult.status,
        },
        'Redis available. Redis-dependent features are enabled.'
      );
    }

    /*
     * Redis is disabled or unavailable.
     *
     * The application MUST NOT crash.
     *
     * Instead, clearly tell the developer what is degraded.
     */
    else {
      app.log.warn(
        {
          redisStatus: redisResult.status,

          degradedFeatures: [
            'Rate limiting may use memory storage',
            'Session cache may be disabled or use fallback storage',
            'WebSocket coordination may run in local/in-process mode',
          ],
        },
        'Redis unavailable. Application is running in degraded mode.'
      );
    }

    /*
     * ---------------------------------------------------------------
     * Start HTTP server
     * ---------------------------------------------------------------
     */

    await app.listen({
      port: config.port,
      host: config.host,
    });

    /*
     * ---------------------------------------------------------------
     * Initialize WebSocket
     * ---------------------------------------------------------------
     *
     * The WebSocket module will later check Redis availability
     * and decide whether to use Redis coordination or local mode.
     */
    initializeWebSocket(app.server, app.log);

    /*
     * Final startup message.
     */
    app.log.info(
      {
        port: config.port,

        host: config.host,

        redisStatus: getRedisStatus(),
      },
      `Server listening on port ${config.port}`
    );
  } catch (err) {
    app.log.error(
      {
        err,
      },
      'Failed to start server'
    );

    process.exit(1);
  }
};

/*
|--------------------------------------------------------------------------
| Graceful Shutdown
|--------------------------------------------------------------------------
*/

const SHUTDOWN_TIMEOUT = 20000;

const gracefulShutdown = async (signal) => {
  app.log.info(
    {
      signal,
    },
    `Received ${signal}, shutting down gracefully...`
  );

  const forceShutdown = setTimeout(() => {
    console.error('Shutdown timed out. Forcing exit.');

    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    /*
     * Stop accepting new requests
     * and finish in-flight requests.
     */
    await app.close();

    /*
     * Close WebSocket server.
     */
    try {
      const io = getIO();

      if (io) {
        app.log.info('Closing WebSocket server...');

        await new Promise((resolve) => {
          io.close(resolve);
        });

        app.log.info('WebSocket server closed');
      }
    } catch (wsErr) {
      app.log.warn(
        {
          err: wsErr,
        },
        'Error closing WebSocket server'
      );
    }

    /*
     * Close database connections.
     */
    try {
      await pool.end();

      app.log.info('Database connection pool closed');
    } catch (dbErr) {
      app.log.warn(
        {
          err: dbErr,
        },
        'Error closing database connection pool'
      );
    }

    /*
     * Close Redis connection.
     */
    try {
      await closeRedis();

      app.log.info('Redis connection closed');
    } catch (redisErr) {
      app.log.warn(
        {
          err: redisErr,
        },
        'Error closing Redis connection'
      );
    }

    clearTimeout(forceShutdown);

    app.log.info('Cleanup completed. Exiting now.');

    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  } catch (err) {
    app.log.error(
      {
        err,
      },
      'Error during shutdown'
    );

    clearTimeout(forceShutdown);

    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
};

/*
|--------------------------------------------------------------------------
| Process Signals
|--------------------------------------------------------------------------
*/

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/*
|--------------------------------------------------------------------------
| Start Application
|--------------------------------------------------------------------------
*/

if (require.main === module) {
  start();
} else {
  module.exports = app;
}
