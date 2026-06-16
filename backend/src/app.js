require('dotenv').config();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Fastify = require('fastify');
const config = require('./config');
const pool = require('./config/db');
const metrics = require('./utils/metrics');
const { initializeWebSocket } = require('./websocket');

const app = Fastify({
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

app.register(require('@fastify/helmet'));

app.register(async function sanitizationPlugin(instance) {
  instance.addHook('onRequest', async (request) => {
    const sanitize = (obj) => {
      if (!obj || typeof obj !== 'object') return;

      for (const key of Object.keys(obj)) {
        const val = obj[key];

        if (typeof val === 'string') {
          obj[key] = val.replace(/<[^>]*>/g, '').replace(/['"]/g, '');
        } else if (typeof val === 'object') {
          sanitize(val);
        }
      }
    };

    sanitize(request.body);
    sanitize(request.query);
    sanitize(request.params);
  });
});

app.register(require('@fastify/rate-limit'), {
  max: 1000,
  timeWindow: '1 minute',
});

app.register(require('@fastify/cookie'));

const { csrfProtection } = require('./middleware/csrf');
app.register(csrfProtection);

app.register(require('@fastify/multipart'), {
  limits: {
    fileSize: config.maxFileSize,
  },
});

app.register(require('@fastify/static'), {
  root: path.join(__dirname, '..', config.uploadDir),
  prefix: '/uploads/',
});

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

app.register(require('./modules/uptoskills/routes'), {
  prefix: '/api/uptoskills',
});

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

app.get('/metrics', metrics.metricsEndpoint);

app.get('/health', async (req, reply) => {
  const { getRedisStatus } = require('./config/redis');
  const redisStatus = getRedisStatus();
  if (redisStatus === 'disconnected') {
    return reply
      .status(503)
      .send({ status: 'degraded', redis: 'disconnected' });
  }
  return reply.send({ status: 'ok' });
});

app.get('/health/db', async (req, reply) => {
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
});

app.get('/health/full', async (req, reply) => {
  const checks = { db: false, redis: false };
  try {
    await pool.query('SELECT 1');
    checks.db = true;
  } catch {}

  const { getRedisStatus } = require('./config/redis');
  const redisStatus = getRedisStatus();
  checks.redis = redisStatus === 'connected' || redisStatus === 'disabled';

  const healthy = checks.db && checks.redis;
  reply
    .status(healthy ? 200 : 503)
    .send({ status: healthy ? 'healthy' : 'degraded', checks });
});

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

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  if (error.name === 'ZodError' || Array.isArray(error.issues)) {
    return reply.status(400).send({
      error: 'Validation error',
      details: error.issues || [],
    });
  }

  return reply.status(error.statusCode || 500).send({
    error: error.message || 'Internal Server Error',
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
