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

export const REPORTS_OPTIONS = { tags: { module: 'reports' } };

export function testGenerateReport(token, csrfToken, cookies) {
  group('Reports - Generate', function () {
    const reportConfig = {
      type: ['daily', 'weekly', 'monthly', 'quarterly', 'custom'][
        Math.floor(Math.random() * 5)
      ],
      format: ['pdf', 'csv', 'xlsx', 'json', 'html'][
        Math.floor(Math.random() * 5)
      ],
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      sections: ['summary', 'attendance', 'performance', 'tasks', 'feedback'],
      filters: {
        department: ['Engineering', 'Marketing', 'All'][
          Math.floor(Math.random() * 3)
        ],
        status: ['active', 'all'][Math.floor(Math.random() * 2)],
      },
      includeCharts: Math.random() > 0.5,
      includeRawData: Math.random() > 0.7,
    };
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.reports.generate}`,
      JSON.stringify(reportConfig),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'generate-report' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'generate-report' });
    checkResponse(resp, 200, {
      'report generation returns 200 or 202': (r) =>
        r.status === 200 || r.status === 202,
      'report has status': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.status || b.id || b.reportId || b.data?.id);
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(3, 8);
  });
}

export function testListReports(token, csrfToken, cookies) {
  group('Reports - List', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.reports.list}?page=1&limit=20&sort=createdAt&order=desc`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'list-reports' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'list-reports' });
    checkResponse(resp, 200, {
      'report list returns data': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.data || b.reports || b.rows || Array.isArray(b));
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 3);
  });
}

export function testGetReport(token, csrfToken, cookies) {
  group('Reports - Get By ID', function () {
    const id = Math.floor(Math.random() * 500) + 1;
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.reports.get(id)}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'get-report' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'get-report' });
    checkResponse(resp, 200, {
      'get report returns 200 or 404': (r) =>
        r.status === 200 || r.status === 404,
    });
    simulateThinkTime(1, 2);
  });
}

export function testDownloadReport(token, csrfToken, cookies) {
  group('Reports - Download', function () {
    const id = Math.floor(Math.random() * 500) + 1;
    const format = ['pdf', 'csv', 'xlsx'][Math.floor(Math.random() * 3)];
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.reports.download(id)}?format=${format}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'download-report' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'download-report' });
    checkResponse(resp, 200, {
      'download returns 200 or 404': (r) =>
        r.status === 200 || r.status === 404,
    });
    simulateThinkTime(2, 5);
  });
}

export function testScheduleReport(token, csrfToken, cookies) {
  group('Reports - Schedule', function () {
    const schedule = {
      type: ['daily', 'weekly', 'monthly'][Math.floor(Math.random() * 3)],
      format: ['pdf', 'csv', 'xlsx'][Math.floor(Math.random() * 3)],
      recipients: [
        `admin${Math.floor(Math.random() * 10)}@test.com`,
        `manager${Math.floor(Math.random() * 10)}@test.com`,
      ],
      cronExpression: ['0 8 * * 1', '0 9 1 * *', '0 7 * * 1-5'][
        Math.floor(Math.random() * 3)
      ],
      startDate: new Date().toISOString().split('T')[0],
      enabled: true,
    };
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.reports.schedule}`,
      JSON.stringify(schedule),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'schedule-report' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'schedule-report' });
    checkResponse(resp, 201, {
      'schedule created': (r) => r.status === 201 || r.status === 200,
    });
    simulateThinkTime(1, 3);
  });
}

export function testReportTemplates(token, csrfToken, cookies) {
  group('Reports - Templates', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.reports.templates}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'report-templates' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'report-templates',
    });
    checkResponse(resp, 200, {
      'templates return list': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.data || b.templates || Array.isArray(b));
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function runAllReportTests(token, csrfToken, cookies) {
  group('Reports - Full Suite', function () {
    testGenerateReport(token, csrfToken, cookies);
    simulateThinkTime(2, 3);
    testReportTemplates(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testScheduleReport(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testListReports(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testGetReport(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testDownloadReport(token, csrfToken, cookies);
    simulateThinkTime(2, 4);
  });
}
