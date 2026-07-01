import { check, sleep, group } from 'k6';
import http from 'k6/http';
import { CONFIG } from '../config.js';
import {
  checkResponse,
  simulateThinkTime,
  generateHeaders,
  errorRate,
  requestDuration,
  apiCalls,
} from './setup.js';

export const ADMIN_OPTIONS = { tags: { module: 'admin' } };

export function testAdminDashboard(token, csrfToken, cookies) {
  group('Admin - Dashboard', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.admin.dashboard}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'admin-dashboard' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'admin-dashboard' });
    checkResponse(resp, 200, {
      'admin dashboard returns data': (r) => {
        try {
          const b = JSON.parse(r.body);
          return b.data !== undefined || b.metrics !== undefined;
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 3);
  });
}

export function testAdminUsers(token, csrfToken, cookies) {
  group('Admin - Users', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.admin.users}?page=1&limit=25&role=all&status=all&sort=createdAt&order=desc`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'admin-users' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'admin-users' });
    checkResponse(resp, 200, {
      'admin users returns list': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.data || b.users || b.rows || Array.isArray(b));
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 3);
  });
}

export function testAdminRevokeUser(token, csrfToken, cookies) {
  group('Admin - Revoke User', function () {
    const userId = Math.floor(Math.random() * 500) + 1;
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.admin.revokeUser(userId)}`,
      JSON.stringify({
        reason: 'Admin initiated session revocation during load test.',
      }),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'admin-revoke-user' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'admin-revoke-user',
    });
    checkResponse(resp, 200, {
      'revoke returns 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    simulateThinkTime(1, 2);
  });
}

export function testAdminSystemLogs(token, csrfToken, cookies) {
  group('Admin - System Logs', function () {
    const params = {
      page: 1,
      limit: 100,
      level: ['info', 'warn', 'error'][Math.floor(Math.random() * 3)],
      startDate: '2026-06-01',
      endDate: '2026-12-31',
      search: '',
    };
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.admin.systemLogs}?${queryString}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'admin-system-logs' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'admin-system-logs',
    });
    checkResponse(resp, 200, {
      'logs return entries': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.data || b.logs || b.entries || Array.isArray(b));
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 3);
  });
}

export function testAdminMetrics(token, csrfToken, cookies) {
  group('Admin - Metrics', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.admin.metrics}?period=24h&granularity=5m`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'admin-metrics' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'admin-metrics' });
    checkResponse(resp, 200, {
      'metrics return data': (r) => {
        try {
          const b = JSON.parse(r.body);
          return b.data !== undefined || b.metrics !== undefined;
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 3);
  });
}

export function testAdminConfig(token, csrfToken, cookies) {
  group('Admin - Config', function () {
    const resp = http.get(`${CONFIG.baseUrl}${CONFIG.endpoints.admin.config}`, {
      headers: generateHeaders(token, csrfToken),
      cookies: cookies || {},
      tags: { name: 'admin-config' },
    });
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'admin-config' });
    checkResponse(resp, 200, {
      'config returns settings': (r) => {
        try {
          const b = JSON.parse(r.body);
          return b.data !== undefined || b.config !== undefined;
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function runAllAdminTests(token, csrfToken, cookies) {
  group('Admin - Full Suite', function () {
    testAdminDashboard(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testAdminUsers(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testAdminSystemLogs(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testAdminMetrics(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testAdminConfig(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testAdminRevokeUser(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
  });
}
