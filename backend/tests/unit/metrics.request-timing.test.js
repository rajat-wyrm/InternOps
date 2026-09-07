const fs = require('fs');
const path = require('path');

describe('HTTP metrics timing safety', () => {
  const metrics = fs.readFileSync(
    path.resolve(__dirname, '../../src/utils/metrics.js'),
    'utf8'
  );
  const app = fs.readFileSync(
    path.resolve(__dirname, '../../src/app.js'),
    'utf8'
  );

  test('starts monotonic timing before CORS can complete OPTIONS', () => {
    const timing = app.indexOf(
      'request.metricsStartTime = process.hrtime.bigint().toString()'
    );
    const cors = app.indexOf("app.register(require('@fastify/cors')");
    expect(timing).toBeGreaterThanOrEqual(0);
    expect(timing).toBeLessThan(cors);
  });

  test('supports OPTIONS and rejects invalid metric durations', () => {
    expect(app).toContain("'OPTIONS'");
    expect(metrics).toContain('Number.isFinite(start)');
    expect(metrics).toContain('Number.isFinite(duration)');
    expect(metrics).toContain('duration < 0');
  });
});
