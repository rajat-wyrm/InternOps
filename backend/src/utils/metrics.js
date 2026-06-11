const client = require('prom-client');

client.collectDefaultMetrics();

const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5,10,25,50,100,250,500,1000,2500,5000],
});

const activeRequests = new client.Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
});

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

module.exports = {
  register: client.register,
  trackActiveRequests,
  observeHttpRequest,
  metricsEndpoint: async (req, reply) => {
    reply.type('text/plain');
    return client.register.metrics();
  },
};
