import { check, sleep, group } from 'k6';
import http from 'k6/http';
import { CONFIG } from '../config.js';
import {
  generateAttendanceRecord,
  generateBulkAttendance,
} from '../generators/data-generator.js';
import {
  makeRequest,
  checkResponse,
  simulateThinkTime,
  generateHeaders,
  errorRate,
  requestDuration,
  apiCalls,
} from './setup.js';

export const ATTENDANCE_OPTIONS = {
  tags: { module: 'attendance' },
};

export function testMarkAttendance(token, csrfToken, cookies) {
  group('Attendance - Mark', function () {
    const record = generateAttendanceRecord();
    record.internId = `INT${Math.floor(Math.random() * 9000) + 1000}`;
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.attendance.mark}`,
      JSON.stringify(record),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'mark-attendance' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'mark-attendance' });
    checkResponse(resp, 201, {
      'attendance marked': (r) => r.status === 201 || r.status === 200,
      'attendance response has ID': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.id || b.attendanceId || b.data?.id);
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 3);
  });
}

export function testBulkMarkAttendance(token, csrfToken, cookies) {
  group('Attendance - Bulk Mark', function () {
    const count = Math.floor(Math.random() * 20) + 10;
    const records = generateBulkAttendance(count).map((r) => ({
      ...r,
      internId: `INT${Math.floor(Math.random() * 9000) + 1000}`,
    }));
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.attendance.bulkMark}`,
      JSON.stringify({ records, count }),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'bulk-mark-attendance' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'bulk-mark-attendance',
    });
    checkResponse(resp, 201, {
      'bulk mark processed': (r) => r.status === 201 || r.status === 200,
      'bulk mark returns count': (r) => {
        try {
          const b = JSON.parse(r.body);
          return (b.count || b.processed || b.data?.count) > 0;
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(2, 5);
  });
}

export function testAttendanceHistory(token, csrfToken, cookies) {
  group('Attendance - History', function () {
    const params = {
      internId: `INT${Math.floor(Math.random() * 9000) + 1000}`,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      page: 1,
      limit: 50,
    };
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.attendance.history}?${queryString}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'attendance-history' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'attendance-history',
    });
    checkResponse(resp, 200, {
      'history returns records': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.data || b.records || b.rows || Array.isArray(b));
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 3);
  });
}

export function testAttendanceStats(token, csrfToken, cookies) {
  group('Attendance - Statistics', function () {
    const params = {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      groupBy: ['day', 'week', 'month', 'department'][
        Math.floor(Math.random() * 4)
      ],
    };
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.attendance.stats}?${queryString}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'attendance-stats' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'attendance-stats',
    });
    checkResponse(resp, 200, {
      'stats return metrics': (r) => {
        try {
          const b = JSON.parse(r.body);
          return (
            b.data !== undefined ||
            b.rate !== undefined ||
            b.summary !== undefined
          );
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function testAttendanceToday(token, csrfToken, cookies) {
  group('Attendance - Today', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.attendance.today}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'attendance-today' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'attendance-today',
    });
    checkResponse(resp, 200, {
      'today attendance returns data': (r) => {
        try {
          const b = JSON.parse(r.body);
          return (
            b.data !== undefined || b.count !== undefined || Array.isArray(b)
          );
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function testAttendanceReport(token, csrfToken, cookies) {
  group('Attendance - Report', function () {
    const params = {
      format: ['pdf', 'csv', 'xlsx'][Math.floor(Math.random() * 3)],
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      departmentId: Math.floor(Math.random() * 10) + 1,
    };
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.attendance.report}?${queryString}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'attendance-report' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'attendance-report',
    });
    checkResponse(resp, 200, {
      'report returns 200 or 202': (r) => r.status === 200 || r.status === 202,
    });
    simulateThinkTime(2, 5);
  });
}

export function testAttendanceExport(token, csrfToken, cookies) {
  group('Attendance - Export', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.attendance.export}?format=csv&startDate=2026-01-01&endDate=2026-12-31`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'attendance-export' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'attendance-export',
    });
    checkResponse(resp, 200, {
      'export returns 200 or 202': (r) => r.status === 200 || r.status === 202,
    });
    simulateThinkTime(2, 4);
  });
}

export function runAllAttendanceTests(token, csrfToken, cookies) {
  group('Attendance - Full Suite', function () {
    testMarkAttendance(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testBulkMarkAttendance(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testAttendanceToday(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testAttendanceHistory(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testAttendanceStats(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testAttendanceReport(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testAttendanceExport(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
  });
}
