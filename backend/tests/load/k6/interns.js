import { check, sleep, group } from 'k6';
import http from 'k6/http';
import { CONFIG } from '../config.js';
import {
  generateIntern,
  generateBulkInterns,
  generateBulkUsers,
} from '../generators/data-generator.js';
import {
  makeRequest,
  getCSRFToken,
  checkResponse,
  simulateThinkTime,
  generateHeaders,
  errorRate,
  requestDuration,
  apiCalls,
} from './setup.js';

export const INTERN_OPTIONS = {
  tags: { module: 'interns' },
};

export function testCreateIntern(token, csrfToken, cookies) {
  group('Interns - Create', function () {
    const intern = generateIntern();
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.interns.create}`,
      JSON.stringify(intern),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'create-intern' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'create-intern' });
    checkResponse(resp, 201, {
      'intern created with ID': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.id || b.internId || b.data?.id);
        } catch (e) {
          return false;
        }
      },
      'intern has correct email': (r) => {
        try {
          const b = JSON.parse(r.body);
          return b.email === intern.email || b.data?.email === intern.email;
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 3);
  });
}

export function testBulkCreateInterns(token, csrfToken, cookies) {
  group('Interns - Bulk Create', function () {
    const count = Math.floor(Math.random() * 10) + 5;
    const interns = generateBulkInterns(count);
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.interns.bulkCreate}`,
      JSON.stringify({ interns, count }),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'bulk-create-interns' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'bulk-create-interns',
    });
    checkResponse(resp, 201, {
      'bulk create returns count': (r) => {
        try {
          const b = JSON.parse(r.body);
          return (b.count || b.created || b.data?.count) > 0;
        } catch (e) {
          return false;
        }
      },
      'bulk create processed all': (r) => {
        try {
          const b = JSON.parse(r.body);
          const created = b.count || b.created || b.data?.count || 0;
          return created === count || created > 0;
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(2, 5);
  });
}

export function testListInterns(token, csrfToken, cookies) {
  group('Interns - List', function () {
    const params = {
      page: Math.floor(Math.random() * 5) + 1,
      limit: [10, 25, 50, 100][Math.floor(Math.random() * 4)],
      sort: ['name', 'createdAt', 'department', 'status'][
        Math.floor(Math.random() * 4)
      ],
      order: ['asc', 'desc'][Math.floor(Math.random() * 2)],
    };
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.interns.list}?${queryString}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'list-interns' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'list-interns' });
    checkResponse(resp, 200, {
      'list returns data': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.data || b.interns || b.rows || Array.isArray(b));
        } catch (e) {
          return false;
        }
      },
      'list response is paginated': (r) => {
        try {
          const b = JSON.parse(r.body);
          return (
            b.total !== undefined ||
            b.totalCount !== undefined ||
            b.pagination !== undefined
          );
        } catch (e) {
          return false;
        }
      },
      'list responds quickly': (r) => r.timings.duration < 2000,
    });
    simulateThinkTime(1, 3);
  });
}

export function testGetIntern(token, csrfToken, cookies, internId) {
  group('Interns - Get By ID', function () {
    const id = internId || `INT${Math.floor(Math.random() * 9000) + 1000}`;
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.interns.get(id)}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'get-intern' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'get-intern' });
    checkResponse(resp, 200, {
      'get intern returns 200 or 404': (r) =>
        r.status === 200 || r.status === 404,
    });
    simulateThinkTime(1, 2);
  });
}

export function testUpdateIntern(token, csrfToken, cookies, internId) {
  group('Interns - Update', function () {
    const id = internId || `INT${Math.floor(Math.random() * 9000) + 1000}`;
    const updateData = {
      firstName: `Updated_${Date.now()}`,
      department: ['Engineering', 'Marketing', 'Sales'][
        Math.floor(Math.random() * 3)
      ],
      status: ['active', 'inactive'][Math.floor(Math.random() * 2)],
    };
    const resp = http.put(
      `${CONFIG.baseUrl}${CONFIG.endpoints.interns.update(id)}`,
      JSON.stringify(updateData),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'update-intern' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'update-intern' });
    checkResponse(resp, 200, {
      'update returns 200 or 404': (r) =>
        r.status === 200 || r.status === 404 || r.status === 403,
    });
    simulateThinkTime(1, 3);
  });
}

export function testDeleteIntern(token, csrfToken, cookies, internId) {
  group('Interns - Delete', function () {
    const id = internId || `INT${Math.floor(Math.random() * 9000) + 1000}`;
    const resp = http.del(
      `${CONFIG.baseUrl}${CONFIG.endpoints.interns.delete(id)}`,
      null,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'delete-intern' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'delete-intern' });
    checkResponse(resp, 200, {
      'delete returns 200 or 404': (r) =>
        r.status === 200 || r.status === 204 || r.status === 404,
    });
    simulateThinkTime(1, 2);
  });
}

export function testSearchInterns(token, csrfToken, cookies) {
  group('Interns - Search', function () {
    const searchTerms = [
      'engineering',
      'marketing',
      'design',
      'product',
      'data',
      'security',
      'devops',
      'developer',
      'intern',
      'senior',
    ];
    const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.interns.search}?q=${encodeURIComponent(term)}&limit=20`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'search-interns' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'search-interns' });
    checkResponse(resp, 200, {
      'search returns results': (r) => {
        try {
          const b = JSON.parse(r.body);
          return (
            b.data !== undefined || b.interns !== undefined || Array.isArray(b)
          );
        } catch (e) {
          return false;
        }
      },
      'search responds quickly': (r) => r.timings.duration < 3000,
    });
    simulateThinkTime(1, 3);
  });
}

export function testExportInterns(token, csrfToken, cookies) {
  group('Interns - Export CSV', function () {
    const format = ['csv', 'xlsx', 'json'][Math.floor(Math.random() * 3)];
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.interns.exportCSV}?format=${format}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'export-interns' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'export-interns' });
    checkResponse(resp, 200, {
      'export returns 200 or 202': (r) => r.status === 200 || r.status === 202,
    });
    simulateThinkTime(2, 5);
  });
}

export function testInternStats(token, csrfToken, cookies) {
  group('Interns - Statistics', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.interns.stats}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'intern-stats' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'intern-stats' });
    checkResponse(resp, 200, {
      'stats returns metrics': (r) => {
        try {
          const b = JSON.parse(r.body);
          return (
            b.total !== undefined ||
            b.count !== undefined ||
            b.data !== undefined
          );
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function runAllInternTests(token, csrfToken, cookies) {
  group('Interns - Full Suite', function () {
    testCreateIntern(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testBulkCreateInterns(token, csrfToken, cookies);
    simulateThinkTime(2, 3);
    testListInterns(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testGetIntern(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testUpdateIntern(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testSearchInterns(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testInternStats(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testExportInterns(token, csrfToken, cookies);
    simulateThinkTime(2, 4);
    testDeleteIntern(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
  });
}
