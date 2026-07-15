import { check, sleep, group } from 'k6';
import http from 'k6/http';
import { CONFIG } from '../config.js';
import { generateUser } from '../generators/data-generator.js';
import {
  makeRequest,
  checkResponse,
  simulateThinkTime,
  generateHeaders,
  errorRate,
  requestDuration,
  apiCalls,
} from './setup.js';

export const MENTOR_OPTIONS = {
  tags: { module: 'mentors' },
};

export function testListMentors(token, csrfToken, cookies) {
  group('Mentors - List', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.mentors.list}?page=1&limit=20&sort=name`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'list-mentors' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'list-mentors' });
    checkResponse(resp, 200, {
      'mentor list returns data': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.data || b.mentors || Array.isArray(b) || b.rows);
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 3);
  });
}

export function testAssignMentor(token, csrfToken, cookies) {
  group('Mentors - Assign', function () {
    const assignment = {
      mentorId: `mentor_${Math.floor(Math.random() * 500) + 1}`,
      internId: `INT${Math.floor(Math.random() * 9000) + 1000}`,
      startDate: new Date().toISOString().split('T')[0],
      notes: `Assigned for ${['Engineering', 'Marketing', 'Design', 'Data Science'][Math.floor(Math.random() * 4)]} mentorship program.`,
    };
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.mentors.assign}`,
      JSON.stringify(assignment),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'assign-mentor' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'assign-mentor' });
    checkResponse(resp, 201, {
      'assign returns 201 or 400': (r) =>
        r.status === 201 ||
        r.status === 200 ||
        r.status === 400 ||
        r.status === 409,
    });
    simulateThinkTime(1, 3);
  });
}

export function testUnassignMentor(token, csrfToken, cookies) {
  group('Mentors - Unassign', function () {
    const payload = {
      mentorId: `mentor_${Math.floor(Math.random() * 500) + 1}`,
      internId: `INT${Math.floor(Math.random() * 9000) + 1000}`,
      reason: 'Mentorship period completed.',
      endDate: new Date().toISOString().split('T')[0],
    };
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.mentors.unassign}`,
      JSON.stringify(payload),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'unassign-mentor' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'unassign-mentor' });
    checkResponse(resp, 200, {
      'unassign returns success': (r) => r.status === 200 || r.status === 404,
    });
    simulateThinkTime(1, 2);
  });
}

export function testGetMyInterns(token, csrfToken, cookies) {
  group('Mentors - My Interns', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.mentors.myInterns}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'my-interns' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'my-interns' });
    checkResponse(resp, 200, {
      'my interns returns list': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.data || b.interns || Array.isArray(b) || b.rows);
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 3);
  });
}

export function testGetMentor(token, csrfToken, cookies) {
  group('Mentors - Get By ID', function () {
    const id = `mentor_${Math.floor(Math.random() * 500) + 1}`;
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.mentors.get(id)}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'get-mentor' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'get-mentor' });
    checkResponse(resp, 200, {
      'get mentor returns 200 or 404': (r) =>
        r.status === 200 || r.status === 404,
    });
    simulateThinkTime(1, 2);
  });
}

export function testBulkAssign(token, csrfToken, cookies) {
  group('Mentors - Bulk Assign', function () {
    const mentorId = `mentor_${Math.floor(Math.random() * 500) + 1}`;
    const internCount = Math.floor(Math.random() * 5) + 3;
    const internIds = Array.from(
      { length: internCount },
      (_, i) => `INT${Math.floor(Math.random() * 9000) + 1000}`
    );
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.mentors.assign}`,
      JSON.stringify({ mentorId, internIds, batchAssign: true }),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'bulk-assign' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'bulk-assign' });
    checkResponse(resp, 201, {
      'bulk assign processed': (r) => r.status === 201 || r.status === 200,
    });
    simulateThinkTime(2, 5);
  });
}

export function runAllMentorTests(token, csrfToken, cookies) {
  group('Mentors - Full Suite', function () {
    testListMentors(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testAssignMentor(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testBulkAssign(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testGetMyInterns(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testGetMentor(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testUnassignMentor(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
  });
}
