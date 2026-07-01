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

export const DASHBOARD_OPTIONS = { tags: { module: 'dashboard' } };

export function testDashboardStats(token, csrfToken, cookies) {
  group('Dashboard - Stats', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.stats}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'dashboard-stats' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'dashboard-stats' });
    checkResponse(resp, 200, {
      'stats returns metrics': (r) => {
        try {
          const b = JSON.parse(r.body);
          return (
            b.data !== undefined ||
            b.users !== undefined ||
            b.totalUsers !== undefined
          );
        } catch (e) {
          return false;
        }
      },
      'stats responds quickly': (r) => r.timings.duration < 2000,
    });
    simulateThinkTime(1, 3);
  });
}

export function testDashboardCharts(token, csrfToken, cookies) {
  group('Dashboard - Charts', function () {
    const params = {
      period: ['daily', 'weekly', 'monthly', 'yearly'][
        Math.floor(Math.random() * 4)
      ],
      metric: ['users', 'attendance', 'performance', 'growth'][
        Math.floor(Math.random() * 4)
      ],
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.charts}?${queryString}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'dashboard-charts' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'dashboard-charts',
    });
    checkResponse(resp, 200, {
      'charts return data points': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.data || b.charts || b.labels || Array.isArray(b));
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 3);
  });
}

export function testDashboardSummary(token, csrfToken, cookies) {
  group('Dashboard - Summary', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.summary}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'dashboard-summary' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'dashboard-summary',
    });
    checkResponse(resp, 200, {
      'summary returns overview': (r) => {
        try {
          const b = JSON.parse(r.body);
          return b.data !== undefined || b.summary !== undefined;
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function testDashboardRecentActivity(token, csrfToken, cookies) {
  group('Dashboard - Recent Activity', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.recentActivity}?limit=50`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'recent-activity' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'recent-activity' });
    checkResponse(resp, 200, {
      'activity returns events': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.data || b.activities || Array.isArray(b));
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function testDashboardAnalytics(token, csrfToken, cookies) {
  group('Dashboard - Analytics', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.analytics}?from=2026-01-01&to=2026-12-31&granularity=month`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'dashboard-analytics' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'dashboard-analytics',
    });
    checkResponse(resp, 200, {
      'analytics returns data': (r) => {
        try {
          const b = JSON.parse(r.body);
          return (
            b.data !== undefined ||
            b.report !== undefined ||
            b.metrics !== undefined
          );
        } catch (e) {
          return false;
        }
      },
      'analytics responds in reasonable time': (r) => r.timings.duration < 5000,
    });
    simulateThinkTime(1, 3);
  });
}

export function testDashboardOverview(token, csrfToken, cookies) {
  group('Dashboard - Overview', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.overview}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'dashboard-overview' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'dashboard-overview',
    });
    checkResponse(resp, 200, {
      'overview returns data': (r) => {
        try {
          const b = JSON.parse(r.body);
          return b.data !== undefined || b.overview !== undefined;
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function testDashboardNotifications(token, csrfToken, cookies) {
  group('Dashboard - Notifications', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.notifications}?limit=20`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'dashboard-notifications' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'dashboard-notifications',
    });
    checkResponse(resp, 200, {
      'dashboard notifications return list': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.data || b.notifications || Array.isArray(b));
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function runAllDashboardTests(token, csrfToken, cookies) {
  group('Dashboard - Full Suite', function () {
    testDashboardStats(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testDashboardSummary(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testDashboardCharts(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testDashboardRecentActivity(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testDashboardAnalytics(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testDashboardNotifications(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testDashboardOverview(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
  });
}
