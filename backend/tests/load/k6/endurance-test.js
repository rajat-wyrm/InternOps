import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { CONFIG, getRandomEmail } from '../config.js';

const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');

export const options = {
  stages: CONFIG.stages.endurance,
  thresholds: CONFIG.thresholds.normal,
};

function steadyRequest(method, url, body, tags) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const params = { headers, tags: { ...tags, type: 'endurance' } };
  let resp;
  switch (method) {
    case 'GET':
      resp = http.get(url, params);
      break;
    case 'POST':
      resp = http.post(url, JSON.stringify(body || {}), params);
      break;
    default:
      resp = http.get(url, params);
  }
  requestDuration.add(resp.timings.duration, { url });
  if (resp.status >= 400) errorRate.add(1);
  return resp;
}

export default function () {
  group('Endurance - Auth', function () {
    steadyRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.auth.csrfToken}`,
      null,
      { module: 'auth' }
    );
    steadyRequest(
      'POST',
      `${CONFIG.baseUrl}${CONFIG.endpoints.auth.login}`,
      {
        email: `load_user_${__VU}@test.com`,
        password: 'LoadTest@123',
      },
      { module: 'auth' }
    );
    sleep(1);
  });

  group('Endurance - Interns', function () {
    steadyRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.interns.list}?page=1&limit=20`,
      null,
      { module: 'interns' }
    );
    steadyRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.interns.stats}`,
      null,
      { module: 'interns' }
    );
    steadyRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.interns.search}?q=test`,
      null,
      { module: 'interns' }
    );
    sleep(1);
  });

  group('Endurance - Dashboard', function () {
    steadyRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.stats}`,
      null,
      { module: 'dashboard' }
    );
    steadyRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.summary}`,
      null,
      { module: 'dashboard' }
    );
    steadyRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.recentActivity}?limit=10`,
      null,
      { module: 'dashboard' }
    );
    sleep(1);
  });

  group('Endurance - Attendance', function () {
    steadyRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.attendance.today}`,
      null,
      { module: 'attendance' }
    );
    steadyRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.attendance.stats}`,
      null,
      { module: 'attendance' }
    );
    sleep(1);
  });

  group('Endurance - Notifications', function () {
    steadyRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.notifications.list}?page=1&limit=10`,
      null,
      { module: 'notifications' }
    );
    steadyRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.notifications.count}`,
      null,
      { module: 'notifications' }
    );
    sleep(1);
  });

  group('Endurance - Memory Check', function () {
    if (__ITER % 10 === 0) {
      const memUsage =
        (process.memoryUsage && process.memoryUsage().heapUsed) || 0;
      console.log(`VU ${__VU}, Iter ${__ITER}: Memory ${memUsage}`);
    }
  });

  sleep(2);
}
