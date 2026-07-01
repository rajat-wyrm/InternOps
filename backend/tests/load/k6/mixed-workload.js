import { group } from 'k6';
import { CONFIG } from '../config.js';
import { setup, loginUser, getCSRFToken } from './setup.js';
import { runAllAuthTests } from './auth.js';
import { runAllInternTests } from './interns.js';
import { runAllMentorTests } from './mentors.js';
import { runAllAttendanceTests } from './attendance.js';
import { runAllProgressTests } from './progress.js';
import { runAllDashboardTests } from './dashboard.js';
import { runAllReportTests } from './reports.js';
import { runAllNotificationTests } from './notifications.js';
import { runAllSessionTests } from './sessions.js';
import { runAllExportTests } from './exports.js';
import { runAllAdminTests } from './admin.js';
import { simulateThinkTime } from './setup.js';

export const options = {
  stages: CONFIG.stages.normal,
  thresholds: CONFIG.thresholds.normal,
};

export default function () {
  const token = '';
  const csrfToken = getCSRFToken({});
  const cookies = {};

  group('Full System - Mixed Workload', function () {
    if (__VU % 10 === 0) {
      runAllAdminTests(token, csrfToken, cookies);
    } else if (__VU % 5 === 0) {
      runAllMentorTests(token, csrfToken, cookies);
    } else if (__VU % 3 === 0) {
      runAllReportTests(token, csrfToken, cookies);
      runAllExportTests(token, csrfToken, cookies);
    } else if (__VU % 2 === 0) {
      runAllAttendanceTests(token, csrfToken, cookies);
      runAllProgressTests(token, csrfToken, cookies);
    } else {
      runAllAuthTests(token, csrfToken, cookies);
      runAllInternTests(token, csrfToken, cookies);
      runAllDashboardTests(token, csrfToken, cookies);
      runAllNotificationTests(token, csrfToken, cookies);
      runAllSessionTests(token, csrfToken, cookies);
    }
    simulateThinkTime(2, 5);
  });
}
