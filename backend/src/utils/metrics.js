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
  const route = req.route ? req.route.path : req.url;
  const duration = Date.now() - startTime;

  httpRequestDurationMicroseconds
    .labels(req.method, route, res.statusCode)
    .observe(duration);
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
