require('dotenv').config();
const Fastify = require('fastify');
const config = require('./config');

const app = Fastify({
  logger: config.nodeEnv === 'development' ? { transport: { target: 'pino-pretty' } } : true,
  genReqId: () => require('uuid').v4(),
});

// CORS
app.register(require('@fastify/cors'), {
  origin: config.nodeEnv === 'production' ? config.corsOrigin : true,
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE'],
  allowedHeaders: ['Content-Type','Authorization','X-CSRF-Token'],
});

// Helmet
app.register(require('@fastify/helmet'));

// Sanitization plugin
app.register(async function sanitizationPlugin(instance, opts) {
  instance.addHook('onRequest', async (request) => {
    const sanitize = (obj) => {
      if (typeof obj !== 'object' || obj === null) return;
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (typeof val === 'string') obj[key] = val.replace(/<[^>]*>/g, '').replace(/['"]/g, '');
        else if (typeof val === 'object') sanitize(val);
      }
    };
    if (request.body) sanitize(request.body);
    if (request.query) sanitize(request.query);
    if (request.params) sanitize(request.params);
  });
});

// Rate limiter – single instance with high limit
app.register(require('@fastify/rate-limit'), { max: 1000, timeWindow: '1 minute' });

// Cookie
app.register(require('@fastify/cookie'));

// CSRF (hook, not plugin)
const { csrfProtection } = require('./middleware/csrf');
app.addHook('onRequest', csrfProtection);

// Multipart & Static
app.register(require('@fastify/multipart'), { limits: { fileSize: config.maxFileSize } });
app.register(require('@fastify/static'), { root: require('path').join(__dirname, '..', config.uploadDir), prefix: '/uploads/' });

// Swagger docs
app.register(require('@fastify/swagger'), { openapi: { info: { title: 'InternOps API', version: '1.0.0' } } });
app.register(require('@fastify/swagger-ui'), { routePrefix: '/docs' });

// Route plugins
app.register(require('./modules/auth/routes'), { prefix: '/api/auth' });
app.register(require('./modules/users/routes'), { prefix: '/api/users' });
app.register(require('./modules/departments/routes'), { prefix: '/api/departments' });
app.register(require('./modules/hierarchy/routes'), { prefix: '/api/hierarchy' });
app.register(require('./modules/team/routes'), { prefix: '/api/team' });
app.register(require('./modules/attendance/routes'), { prefix: '/api/attendance' });
app.register(require('./modules/ratings/routes'), { prefix: '/api/ratings' });
app.register(require('./modules/social-tasks/routes'), { prefix: '/api/tasks' });
app.register(require('./modules/proof-submissions/routes'), { prefix: '/api/proofs' });
app.register(require('./modules/notifications/routes'), { prefix: '/api/notifications' });
app.register(require('./modules/audit/routes'), { prefix: '/api/audit' });
app.register(require('./modules/uploads/routes'), { prefix: '/api/uploads' });
app.register(require('./modules/analytics/routes'), { prefix: '/api/analytics' });
app.register(require('./modules/meetings/routes'), { prefix: '/api/meetings' });
app.register(require('./modules/sessions/routes'), { prefix: '/api/sessions' });
app.register(require('./modules/reports/routes'), { prefix: '/api/reports' });
app.register(require('./modules/reports/export'), { prefix: '/api/reports/export' });
app.register(require('./modules/uptoskills/routes'), { prefix: '/api/uptoskills' });

// Fallback HTML page
app.get('/fallback', async (req, reply) => {
  reply.type('text/html').send('<html><body style="font-family:sans-serif;padding:2em"><h1>InternOps API is running</h1><p><a href="/docs">Swagger Docs</a></p><p><a href="/health">Health Check</a></p></body></html>');
});

// Root redirect to docs
app.get('/', async (req, reply) => reply.redirect('/docs'));

// Health checks
app.get('/health', async () => ({ status: 'ok' }));
app.get('/health/db', async (req, reply) => {
  try { await require('./config/db').query('SELECT 1'); reply.send({ status: 'ok', db: 'connected' }); }
  catch (err) { reply.status(503).send({ status: 'error', db: 'disconnected' }); }
});
app.get('/health/full', async (req, reply) => {
  const checks = { db: false, redis: false };
  try { await require('./config/db').query('SELECT 1'); checks.db = true; } catch (e) {}
  try { const r = require('./config/redis'); const c = await r.getRedisClient(); if (c) { await c.ping(); checks.redis = true; } } catch (e) {}
  const healthy = Object.values(checks).every(Boolean);
  reply.status(healthy ? 200 : 503).send({ status: healthy ? 'healthy' : 'degraded', checks });
});

// Request logging
app.addHook('onRequest', async (request) => {
  request.log.info({ reqId: request.id, method: request.method, url: request.url }, 'incoming');
});

// Global error handler
app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  reply.status(error.statusCode || 500).send({ error: error.message || 'Internal Server Error' });
});

// Cron jobs
require('./utils/cron').setupCronJobs();

// Start
const start = async () => {
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`Server listening on port ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();