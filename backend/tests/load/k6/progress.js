import { check, sleep, group } from 'k6';
import http from 'k6/http';
import { CONFIG } from '../config.js';
import { generateProgressEntry } from '../generators/data-generator.js';
import {
  makeRequest,
  checkResponse,
  simulateThinkTime,
  generateHeaders,
  errorRate,
  requestDuration,
  apiCalls,
} from './setup.js';

export const PROGRESS_OPTIONS = {
  tags: { module: 'progress' },
};

export function testSubmitProgress(token, csrfToken, cookies) {
  group('Progress - Submit', function () {
    const entry = generateProgressEntry();
    entry.internId = `INT${Math.floor(Math.random() * 9000) + 1000}`;
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.progress.submit}`,
      JSON.stringify(entry),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'submit-progress' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'submit-progress' });
    checkResponse(resp, 201, {
      'progress submitted': (r) => r.status === 201 || r.status === 200,
      'progress has ID': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.id || b.progressId || b.data?.id);
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 3);
  });
}

export function testListProgress(token, csrfToken, cookies) {
  group('Progress - List', function () {
    const params = {
      internId: `INT${Math.floor(Math.random() * 9000) + 1000}`,
      page: 1,
      limit: 20,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      status: ['submitted', 'approved', 'pending_review'][
        Math.floor(Math.random() * 3)
      ],
    };
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.progress.list}?${queryString}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'list-progress' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'list-progress' });
    checkResponse(resp, 200, {
      'progress list returns data': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.data || b.progress || b.rows || Array.isArray(b));
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 3);
  });
}

export function testGetProgress(token, csrfToken, cookies) {
  group('Progress - Get By ID', function () {
    const id = Math.floor(Math.random() * 10000) + 1;
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.progress.get(id)}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'get-progress' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'get-progress' });
    checkResponse(resp, 200, {
      'get progress returns 200 or 404': (r) =>
        r.status === 200 || r.status === 404,
    });
    simulateThinkTime(1, 2);
  });
}

export function testReviewProgress(token, csrfToken, cookies) {
  group('Progress - Review', function () {
    const id = Math.floor(Math.random() * 10000) + 1;
    const review = {
      rating: Math.floor(Math.random() * 5) + 1,
      feedback: [
        'Excellent work!',
        'Good progress, keep it up.',
        'Needs improvement in documentation.',
        'Great problem-solving skills.',
        'Consider improving code quality.',
        'Outstanding performance this week.',
        'Meeting expectations.',
        'Above average performance.',
      ][Math.floor(Math.random() * 8)],
      status: ['approved', 'revision_required'][Math.floor(Math.random() * 2)],
      reviewedBy: `mentor_${Math.floor(Math.random() * 500) + 1}`,
    };
    const resp = http.put(
      `${CONFIG.baseUrl}${CONFIG.endpoints.progress.review(id)}`,
      JSON.stringify(review),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'review-progress' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'review-progress' });
    checkResponse(resp, 200, {
      'review returns 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    simulateThinkTime(1, 3);
  });
}

export function testProgressStats(token, csrfToken, cookies) {
  group('Progress - Statistics', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.progress.stats}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'progress-stats' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'progress-stats' });
    checkResponse(resp, 200, {
      'progress stats return metrics': (r) => {
        try {
          const b = JSON.parse(r.body);
          return (
            b.data !== undefined ||
            b.summary !== undefined ||
            b.total !== undefined
          );
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function testWeeklyProgress(token, csrfToken, cookies) {
  group('Progress - Weekly', function () {
    const internId = `INT${Math.floor(Math.random() * 9000) + 1000}`;
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.progress.weekly}?internId=${internId}&weekStart=2026-06-29`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'weekly-progress' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'weekly-progress' });
    checkResponse(resp, 200, {
      'weekly progress returns data': (r) => {
        try {
          const b = JSON.parse(r.body);
          return (
            b.data !== undefined || b.entries !== undefined || Array.isArray(b)
          );
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 3);
  });
}

export function runAllProgressTests(token, csrfToken, cookies) {
  group('Progress - Full Suite', function () {
    testSubmitProgress(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testListProgress(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testGetProgress(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testReviewProgress(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testProgressStats(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testWeeklyProgress(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
  });
}
