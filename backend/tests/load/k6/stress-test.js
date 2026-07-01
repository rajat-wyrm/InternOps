import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { CONFIG, getRandomEmail, getRandomName } from '../config.js';
import {
  generateUser,
  generateIntern,
  generateAttendanceRecord,
  generateProgressEntry,
  generateBulkInterns,
  generateBulkAttendance,
} from '../generators/data-generator.js';

const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');

export const options = {
  stages: CONFIG.stages.stress,
  thresholds: CONFIG.thresholds.stress,
};

function makeRequest(method, url, body, token) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const params = { headers, tags: { type: 'stress', url } };
  let resp;
  switch (method) {
    case 'GET':
      resp = http.get(url, params);
      break;
    case 'POST':
      resp = http.post(url, JSON.stringify(body || {}), params);
      break;
    case 'PUT':
      resp = http.put(url, JSON.stringify(body || {}), params);
      break;
    case 'DELETE':
      resp = http.del(url, JSON.stringify(body || {}), params);
      break;
    default:
      resp = http.get(url, params);
  }
  requestDuration.add(resp.timings.duration, { url });
  if (resp.status >= 400) errorRate.add(1);
  return resp;
}

function phase1_AuthStress() {
  group('Stress - Authentication', function () {
    const csrfResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.auth.csrfToken}`
    );
    check(csrfResp, { 'CSRF accessible under load': (r) => r.status < 500 });
    const user = generateUser();
    const loginResp = makeRequest(
      'POST',
      `${CONFIG.baseUrl}${CONFIG.endpoints.auth.login}`,
      { email: user.email, password: user.password }
    );
    check(loginResp, { 'login handles load': (r) => r.status < 500 });
    if (loginResp.status === 200) {
      try {
        const body = JSON.parse(loginResp.body);
        const token = body.accessToken || body.token;
        const refreshResp = makeRequest(
          'POST',
          `${CONFIG.baseUrl}${CONFIG.endpoints.auth.refresh}`,
          {},
          token
        );
        check(refreshResp, { 'refresh handles load': (r) => r.status < 500 });
      } catch (e) {}
    }
    sleep(0.5);
  });
}

function phase2_InternStress() {
  group('Stress - Intern Operations', function () {
    const listResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.interns.list}?page=1&limit=100`
    );
    check(listResp, { 'intern list handles load': (r) => r.status < 500 });
    const searchResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.interns.search}?q=engineering&limit=50`
    );
    check(searchResp, { 'intern search handles load': (r) => r.status < 500 });
    const statsResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.interns.stats}`
    );
    check(statsResp, { 'intern stats handles load': (r) => r.status < 500 });
    sleep(0.3);

    for (let i = 0; i < 3; i++) {
      const intern = generateIntern();
      const createResp = makeRequest(
        'POST',
        `${CONFIG.baseUrl}${CONFIG.endpoints.interns.create}`,
        intern
      );
      check(createResp, {
        'intern create handles load': (r) => r.status < 500,
      });
    }
    sleep(0.5);
  });
}

function phase3_AttendanceStress() {
  group('Stress - Attendance', function () {
    const todayResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.attendance.today}`
    );
    check(todayResp, {
      'today attendance handles load': (r) => r.status < 500,
    });
    const statsResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.attendance.stats}?startDate=2026-01-01&endDate=2026-12-31&groupBy=month`
    );
    check(statsResp, {
      'attendance stats handles load': (r) => r.status < 500,
    });
    for (let i = 0; i < 5; i++) {
      const record = generateAttendanceRecord();
      record.internId = `INT${Math.floor(Math.random() * 9000) + 1000}`;
      const markResp = makeRequest(
        'POST',
        `${CONFIG.baseUrl}${CONFIG.endpoints.attendance.mark}`,
        record
      );
      check(markResp, {
        'mark attendance handles load': (r) => r.status < 500,
      });
    }
    sleep(0.5);
  });
}

function phase4_ProgressStress() {
  group('Stress - Progress', function () {
    for (let i = 0; i < 5; i++) {
      const entry = generateProgressEntry();
      entry.internId = `INT${Math.floor(Math.random() * 9000) + 1000}`;
      const submitResp = makeRequest(
        'POST',
        `${CONFIG.baseUrl}${CONFIG.endpoints.progress.submit}`,
        entry
      );
      check(submitResp, {
        'progress submit handles load': (r) => r.status < 500,
      });
    }
    const statsResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.progress.stats}`
    );
    check(statsResp, { 'progress stats handles load': (r) => r.status < 500 });
    sleep(0.5);
  });
}

function phase5_DashboardStress() {
  group('Stress - Dashboard', function () {
    const statsResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.stats}`
    );
    check(statsResp, { 'dashboard stats handles load': (r) => r.status < 500 });
    const chartsResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.charts}?period=monthly&metric=users`
    );
    check(chartsResp, {
      'dashboard charts handles load': (r) => r.status < 500,
    });
    const analyticsResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.analytics}?from=2026-01-01&to=2026-12-31`
    );
    check(analyticsResp, {
      'dashboard analytics handles load': (r) => r.status < 500,
    });
    const summaryResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.summary}`
    );
    check(summaryResp, {
      'dashboard summary handles load': (r) => r.status < 500,
    });
    sleep(0.5);
  });
}

function phase6_NotificationStress() {
  group('Stress - Notifications', function () {
    const listResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.notifications.list}?page=1&limit=50`
    );
    check(listResp, {
      'notification list handles load': (r) => r.status < 500,
    });
    const countResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.notifications.count}`
    );
    check(countResp, {
      'notification count handles load': (r) => r.status < 500,
    });
    sleep(0.3);
  });
}

function phase7_MentorStress() {
  group('Stress - Mentor Operations', function () {
    const listResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.mentors.list}?page=1&limit=50`
    );
    check(listResp, { 'mentor list handles load': (r) => r.status < 500 });
    const myInternsResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.mentors.myInterns}`
    );
    check(myInternsResp, { 'my interns handles load': (r) => r.status < 500 });
    sleep(0.5);
  });
}

function phase8_SessionStress() {
  group('Stress - Sessions', function () {
    const listResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.sessions.list}`
    );
    check(listResp, { 'session list handles load': (r) => r.status < 500 });
    const currentResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.sessions.current}`
    );
    check(currentResp, {
      'current session handles load': (r) => r.status < 500,
    });
    sleep(0.3);
  });
}

function phase9_ExportStress() {
  group('Stress - Exports', function () {
    const csvResp = makeRequest(
      'POST',
      `${CONFIG.baseUrl}${CONFIG.endpoints.exports.csv}`,
      {
        type: 'csv',
        module: 'interns',
        filters: { startDate: '2026-01-01', endDate: '2026-12-31' },
      }
    );
    check(csvResp, { 'export handles load': (r) => r.status < 500 });
    sleep(1);
  });
}

function phase10_AdminStress() {
  group('Stress - Admin', function () {
    const dashboardResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.admin.dashboard}`
    );
    check(dashboardResp, {
      'admin dashboard handles load': (r) => r.status < 500,
    });
    const usersResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.admin.users}?page=1&limit=50`
    );
    check(usersResp, { 'admin users handles load': (r) => r.status < 500 });
    const logsResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.admin.systemLogs}?page=1&limit=50`
    );
    check(logsResp, { 'admin logs handles load': (r) => r.status < 500 });
    const metricsResp = makeRequest(
      'GET',
      `${CONFIG.baseUrl}${CONFIG.endpoints.admin.metrics}`
    );
    check(metricsResp, { 'admin metrics handles load': (r) => r.status < 500 });
    sleep(0.5);
  });
}

export default function () {
  const phases = [
    phase1_AuthStress,
    phase2_InternStress,
    phase3_AttendanceStress,
    phase4_ProgressStress,
    phase5_DashboardStress,
    phase6_NotificationStress,
    phase7_MentorStress,
    phase8_SessionStress,
    phase9_ExportStress,
    phase10_AdminStress,
  ];
  const phase = phases[Math.floor(Math.random() * phases.length)];
  phase();
  sleep(1);
}
