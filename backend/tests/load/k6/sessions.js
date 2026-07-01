import { check, sleep, group } from 'k6';
import http from 'k6/http';
import { CONFIG } from '../config.js';
import {
  generateSession,
  generateBulkUsers,
} from '../generators/data-generator.js';
import {
  checkResponse,
  simulateThinkTime,
  generateHeaders,
  errorRate,
  requestDuration,
  apiCalls,
} from './setup.js';

export const SESSIONS_OPTIONS = { tags: { module: 'sessions' } };

export function testListSessions(token, csrfToken, cookies) {
  group('Sessions - List', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.sessions.list}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'list-sessions' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'list-sessions' });
    checkResponse(resp, 200, {
      'session list returns data': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.data || b.sessions || b.rows || Array.isArray(b));
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function testGetCurrentSession(token, csrfToken, cookies) {
  group('Sessions - Current', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.sessions.current}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'current-session' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'current-session' });
    checkResponse(resp, 200, {
      'current session returns details': (r) => {
        try {
          const b = JSON.parse(r.body);
          return (
            b.data !== undefined ||
            b.session !== undefined ||
            b.id !== undefined
          );
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function testRevokeSession(token, csrfToken, cookies) {
  group('Sessions - Revoke', function () {
    const id = `sess_${Math.floor(Math.random() * 10000)}`;
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.sessions.revoke(id)}`,
      JSON.stringify({}),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'revoke-session' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'revoke-session' });
    checkResponse(resp, 200, {
      'revoke returns 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    simulateThinkTime(1, 2);
  });
}

export function testRevokeAllSessions(token, csrfToken, cookies) {
  group('Sessions - Revoke All', function () {
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.sessions.revokeAll}`,
      JSON.stringify({}),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'revoke-all-sessions' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'revoke-all-sessions',
    });
    checkResponse(resp, 200, {
      'revoke all returns success': (r) => {
        try {
          const b = JSON.parse(r.body);
          return b.success !== false || b.status === 'ok';
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(2, 5);
  });
}

export function runAllSessionTests(token, csrfToken, cookies) {
  group('Sessions - Full Suite', function () {
    testGetCurrentSession(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testListSessions(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testRevokeSession(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testRevokeAllSessions(token, csrfToken, cookies);
    simulateThinkTime(2, 3);
  });
}
