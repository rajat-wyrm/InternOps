import { check, sleep, group } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { CONFIG, getRandomEmail, getRandomName } from '../config.js';
import {
  generateUser,
  generateIntern,
  generateAttendanceRecord,
  generateProgressEntry,
} from '../generators/data-generator.js';

export const errorRate = new Rate('errors');
export const requestDuration = new Trend('request_duration');
export const apiCalls = new Counter('api_calls');
export const activeUsers = new Gauge('active_users');
export const loginSuccess = new Counter('login_success');
export const loginFailure = new Counter('login_failure');
export const tokenRefreshCount = new Counter('token_refresh');
export const csrfTokenCount = new Counter('csrf_token_requests');

export const BASE_OPTIONS = {
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  tags: { workload: 'mixed' },
  timeout: '30s',
  discardResponseBodies: false,
  responseCallback: http.expectedStatuses(200, 201, 204, 302),
};

const authTokens = [];
const csrfTokens = [];

export function setup() {
  console.log('Setting up load test environment...');
  const csrfResp = http.get(
    `${CONFIG.baseUrl}${CONFIG.endpoints.auth.csrfToken}`,
    {
      headers: { Accept: 'application/json' },
    }
  );
  check(csrfResp, {
    'CSRF token endpoint accessible': (r) => r.status === 200,
  });
  console.log(`Setup complete. Base URL: ${CONFIG.baseUrl}`);
  return {};
}

export function getCSRFToken(cookies) {
  const resp = http.get(`${CONFIG.baseUrl}${CONFIG.endpoints.auth.csrfToken}`, {
    headers: { Accept: 'application/json' },
    cookies: cookies || {},
  });
  csrfTokenCount.add(1);
  if (resp.status === 200) {
    try {
      const body = JSON.parse(resp.body);
      const token = body.csrfToken || body.token || body.data?.csrfToken || '';
      if (token) return token;
    } catch (e) {
      console.error('Failed to parse CSRF response');
    }
  }
  return '';
}

export function loginUser(credentials, cookies) {
  const payload = JSON.stringify(
    credentials || {
      email: getRandomEmail(),
      password: 'LoadTest@123',
    }
  );
  const resp = http.post(
    `${CONFIG.baseUrl}${CONFIG.endpoints.auth.login}`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      cookies: cookies || {},
      tags: { name: 'login' },
    }
  );
  apiCalls.add(1);
  requestDuration.add(resp.timings.duration, { endpoint: 'login' });
  let token = '';
  let csrfToken = '';
  if (resp.status === 200) {
    loginSuccess.add(1);
    try {
      const body = JSON.parse(resp.body);
      token = body.accessToken || body.token || body.data?.accessToken || '';
      csrfToken = body.csrfToken || '';
    } catch (e) {
      console.error('Login response parse error');
    }
  } else {
    loginFailure.add(1);
    errorRate.add(1);
  }
  return { response: resp, token, csrfToken, cookies: resp.cookies };
}

export function refreshToken(token, cookies) {
  const headers = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const resp = http.post(
    `${CONFIG.baseUrl}${CONFIG.endpoints.auth.refresh}`,
    JSON.stringify({}),
    { headers, cookies: cookies || {}, tags: { name: 'refresh' } }
  );
  tokenRefreshCount.add(1);
  apiCalls.add(1);
  requestDuration.add(resp.timings.duration, { endpoint: 'refresh' });
  let newToken = '';
  if (resp.status === 200) {
    try {
      const body = JSON.parse(resp.body);
      newToken = body.accessToken || body.token || '';
    } catch (e) {}
  }
  return { response: resp, token: newToken };
}

export function makeRequest(
  method,
  endpoint,
  body,
  token,
  csrfToken,
  cookies,
  tags
) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const url = `${CONFIG.baseUrl}${endpoint}`;
  const params = {
    headers,
    cookies: cookies || {},
    tags: { ...tags, url: endpoint },
    timeout: '30s',
  };
  let resp;
  const startTime = Date.now();
  switch (method.toUpperCase()) {
    case 'GET':
      resp = http.get(url, params);
      break;
    case 'POST':
      resp = http.post(url, JSON.stringify(body || {}), params);
      break;
    case 'PUT':
      resp = http.put(url, JSON.stringify(body || {}), params);
      break;
    case 'PATCH':
      resp = http.patch(url, JSON.stringify(body || {}), params);
      break;
    case 'DELETE':
      resp = http.del(url, JSON.stringify(body || {}), params);
      break;
    default:
      resp = http.get(url, params);
  }
  apiCalls.add(1);
  requestDuration.add(Date.now() - startTime, {
    endpoint: endpoint.split('/')[1] || 'unknown',
  });
  const success = resp.status >= 200 && resp.status < 500;
  if (!success || resp.status >= 400) errorRate.add(1);
  return { response: resp, success: success && resp.status < 400 };
}

export function generateHeaders(token, csrfToken) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  headers['User-Agent'] = `k6-load-test/${__VERSION || '0.50.0'}`;
  headers['X-Request-Id'] =
    `load_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  headers['X-Client-Timestamp'] = new Date().toISOString();
  headers['Cache-Control'] = 'no-cache';
  headers['Pragma'] = 'no-cache';
  return headers;
}

export function simulateThinkTime(minSec, maxSec) {
  const delay = minSec + Math.random() * (maxSec - minSec);
  sleep(delay);
}

export function checkResponse(resp, expectedStatus, checks) {
  const baseCheck = {
    'status is expected': (r) => r.status === expectedStatus,
    'response has body': (r) => r.body && r.body.length > 0,
    'response is valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch (e) {
        return false;
      }
    },
    ...checks,
  };
  const result = check(resp, baseCheck);
  if (!result) errorRate.add(1);
  return result;
}

export function logMetrics(label, resp) {
  console.log(
    `[${label}] Status: ${resp.status}, Duration: ${resp.timings?.duration || 0}ms, Size: ${resp.body?.length || 0} bytes`
  );
}

export function defaultOptions(stageConfig, thresholds) {
  return {
    stages: stageConfig || CONFIG.stages.baseline,
    thresholds: thresholds || CONFIG.thresholds.baseline,
    ext: {
      loadimpact: {
        name: 'InternOps Load Test',
        project: 'Intern Management System',
      },
    },
  };
}
