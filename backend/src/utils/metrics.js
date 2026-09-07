const client = require('prom-client');

client.collectDefaultMetrics();

// Existing HTTP metrics
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
});

const activeRequests = new client.Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
});

// New AI Telemetry Metrics requested by your Team Leader
const aiServiceDuration = new client.Histogram({
  name: 'ai_service_duration_ms',
  help: 'Duration of external AI service API calls in ms',
  labelNames: ['service'],
});

const aiTokenUsage = new client.Counter({
  name: 'ai_service_token_usage_total',
  help: 'Total tokens consumed by the AI service provider',
  labelNames: ['service'],
});

const aiServiceErrors = new client.Counter({
  name: 'ai_service_errors_total',
  help: 'Total count of exceptions and errors thrown by the AI service provider',
  labelNames: ['service'],
});

// Existing functions
async function trackActiveRequests(request, reply) {
  activeRequests.inc();

  reply.raw.on('finish', () => {
    activeRequests.dec();
  });
}

function observeHttpRequest(req, res, startTime) {
  const route = req.routeOptions?.url || req.routerPath || req.url;
  const start = Number(startTime);
  if (!Number.isFinite(start)) {
    req.log?.warn(
      { method: req.method, route },
      'Skipping HTTP duration metric because request start time is missing'
    );
    return false;
  }
  const duration =
    Number(process.hrtime.bigint() - BigInt(Math.trunc(start))) / 1e6;
  if (!Number.isFinite(duration) || duration < 0) {
    req.log?.warn(
      { method: req.method, route, duration },
      'Skipping invalid HTTP duration metric'
    );
    return false;
  }
  httpRequestDurationMicroseconds
    .labels(req.method, route, res.statusCode)
    .observe(duration);
  return true;
}

// Custom wrapper functions exposed for use in ai.service.js
function recordLatency(serviceName, duration) {
  aiServiceDuration.labels(serviceName).observe(duration);
}

function recordTokenUsage(tokens) {
  if (tokens && typeof tokens === 'number') {
    aiTokenUsage.labels('ai_service').inc(tokens);
  }
}

function recordError(serviceName) {
  aiServiceErrors.labels(serviceName).inc();
}

module.exports = {
  register: client.register,
  trackActiveRequests,
  observeHttpRequest,
  recordLatency,
  recordTokenUsage,
  recordError,
  metricsEndpoint: async (req, reply) => {
    reply.type('text/plain');
    return client.register.metrics();
  },
};
