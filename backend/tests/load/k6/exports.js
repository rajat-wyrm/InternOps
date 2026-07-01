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

export const EXPORTS_OPTIONS = { tags: { module: 'exports' } };

export function testExportData(token, csrfToken, cookies) {
  group('Exports - Export Data', function () {
    const exportConfig = {
      type: ['csv', 'xlsx', 'pdf'][Math.floor(Math.random() * 3)],
      module: ['interns', 'attendance', 'progress', 'reports'][
        Math.floor(Math.random() * 4)
      ],
      filters: {
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        department: ['Engineering', 'Marketing', 'Sales'][
          Math.floor(Math.random() * 3)
        ],
        status: 'active',
      },
      columns: ['name', 'email', 'department', 'status', 'createdAt'],
      includeHeaders: true,
    };
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.exports.csv}`,
      JSON.stringify(exportConfig),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'export-data' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'export-data' });
    checkResponse(resp, 200, {
      'export returns 200 or 202': (r) => r.status === 200 || r.status === 202,
    });
    simulateThinkTime(3, 8);
  });
}

export function testExportPDF(token, csrfToken, cookies) {
  group('Exports - PDF Export', function () {
    const exportConfig = {
      title: 'Performance Report',
      orientation: ['portrait', 'landscape'][Math.floor(Math.random() * 2)],
      pageSize: 'A4',
      includeCoverPage: Math.random() > 0.5,
      includeTableOfContents: Math.random() > 0.5,
      sections: [
        { title: 'Executive Summary', type: 'text' },
        { title: 'Attendance Chart', type: 'chart' },
        { title: 'Performance Metrics', type: 'table' },
        { title: 'Recommendations', type: 'text' },
      ],
      branding: {
        companyName: 'InternOps',
        logoUrl: '',
        primaryColor: '#2563eb',
      },
    };
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.exports.pdf}`,
      JSON.stringify(exportConfig),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'export-pdf' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'export-pdf' });
    checkResponse(resp, 200, {
      'PDF export returns 200 or 202': (r) =>
        r.status === 200 || r.status === 202,
    });
    simulateThinkTime(3, 8);
  });
}

export function testExportExcel(token, csrfToken, cookies) {
  group('Exports - Excel Export', function () {
    const exportConfig = {
      sheets: [
        { name: 'Overview', data: 'overview' },
        { name: 'Details', data: 'details' },
        { name: 'Summary', data: 'summary' },
      ],
      includeCharts: Math.random() > 0.5,
      includeFormulas: Math.random() > 0.7,
    };
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.exports.excel}`,
      JSON.stringify(exportConfig),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'export-excel' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'export-excel' });
    checkResponse(resp, 200, {
      'Excel export returns 200 or 202': (r) =>
        r.status === 200 || r.status === 202,
    });
    simulateThinkTime(3, 8);
  });
}

export function testExportStatus(token, csrfToken, cookies) {
  group('Exports - Status Check', function () {
    const id = Math.floor(Math.random() * 1000) + 1;
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.exports.status(id)}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'export-status' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'export-status' });
    checkResponse(resp, 200, {
      'status returns 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    simulateThinkTime(1, 2);
  });
}

export function testExportDownload(token, csrfToken, cookies) {
  group('Exports - Download', function () {
    const id = Math.floor(Math.random() * 1000) + 1;
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.exports.download(id)}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'export-download' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'export-download' });
    checkResponse(resp, 200, {
      'download returns 200 or 404': (r) =>
        r.status === 200 || r.status === 404,
    });
    simulateThinkTime(2, 5);
  });
}

export function runAllExportTests(token, csrfToken, cookies) {
  group('Exports - Full Suite', function () {
    testExportData(token, csrfToken, cookies);
    simulateThinkTime(2, 4);
    testExportPDF(token, csrfToken, cookies);
    simulateThinkTime(2, 4);
    testExportExcel(token, csrfToken, cookies);
    simulateThinkTime(2, 4);
    testExportStatus(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testExportDownload(token, csrfToken, cookies);
    simulateThinkTime(2, 3);
  });
}
