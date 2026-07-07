import { check, sleep, group } from 'k6';
import http from 'k6/http';
import { CONFIG, getRandomEmail } from '../config.js';
import { generateUser } from '../generators/data-generator.js';
import {
  makeRequest,
  getCSRFToken,
  checkResponse,
  simulateThinkTime,
  generateHeaders,
  errorRate,
  requestDuration,
  apiCalls,
  loginSuccess,
  loginFailure,
} from './setup.js';

export const AUTH_OPTIONS = {
  tags: { module: 'auth' },
};

export function testLoginFlow(token, csrfToken, cookies) {
  group('Authentication - Login Flow', function () {
    const credentials = {
      email: getRandomEmail(),
      password: 'LoadTest@123',
    };
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.auth.login}`,
      JSON.stringify(credentials),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'login' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'login' });
    const success = checkResponse(resp, 200, {
      'login returns access token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!(body.accessToken || body.token || body.data?.accessToken);
        } catch (e) {
          return false;
        }
      },
      'login returns user data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!(body.user || body.data?.user);
        } catch (e) {
          return false;
        }
      },
      'login response time acceptable': (r) => r.timings.duration < 3000,
    });
    if (success) loginSuccess.add(1);
    else loginFailure.add(1);
    check(resp, {
      'login response has cookies': (r) => Object.keys(r.cookies).length > 0,
    });
    simulateThinkTime(1, 3);
  });
}

export function testRegistrationFlow(token, csrfToken, cookies) {
  group('Authentication - Registration Flow', function () {
    const userData = generateUser();
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.auth.register}`,
      JSON.stringify(userData),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'register' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'register' });
    checkResponse(resp, 201, {
      'registration returns user ID': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.id || b.userId || b.data?.id);
        } catch (e) {
          return false;
        }
      },
      'registration returns email': (r) => {
        try {
          const b = JSON.parse(r.body);
          return b.email === userData.email || b.data?.email === userData.email;
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function testTokenRefresh(token, csrfToken, cookies) {
  group('Authentication - Token Refresh', function () {
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.auth.refresh}`,
      JSON.stringify({}),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'refresh' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'refresh' });
    const success = checkResponse(resp, 200, {
      'refresh returns new token': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.accessToken || b.token);
        } catch (e) {
          return false;
        }
      },
      'refresh token is different': (r) => {
        try {
          const b = JSON.parse(r.body);
          const newToken = b.accessToken || b.token;
          return newToken && newToken !== token;
        } catch (e) {
          return false;
        }
      },
      'refresh completes quickly': (r) => r.timings.duration < 2000,
    });
    if (success && resp.status === 200) {
      try {
        const body = JSON.parse(resp.body);
        token = body.accessToken || body.token || token;
      } catch (e) {}
    }
    simulateThinkTime(1, 2);
  });
  return token;
}

export function testLogoutFlow(token, csrfToken, cookies) {
  group('Authentication - Logout Flow', function () {
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.auth.logout}`,
      JSON.stringify({}),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'logout' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'logout' });
    checkResponse(resp, 200, {
      'logout returns success': (r) => {
        try {
          const b = JSON.parse(r.body);
          return b.success !== false;
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function testCsrfTokenGeneration(token, csrfToken, cookies) {
  group('Authentication - CSRF Token', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.auth.csrfToken}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'csrf-token' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'csrf-token' });
    checkResponse(resp, 200, {
      'CSRF response has token': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.csrfToken || b.token || b.data?.csrfToken);
        } catch (e) {
          return false;
        }
      },
      'CSRF response has cookie': (r) => Object.keys(r.cookies).length > 0,
    });
    simulateThinkTime(1, 2);
  });
}

export function testForgotPasswordFlow(token, csrfToken, cookies) {
  group('Authentication - Forgot Password', function () {
    const email = getRandomEmail();
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.auth.forgotPassword}`,
      JSON.stringify({ email }),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'forgot-password' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'forgot-password' });
    checkResponse(resp, 200, {
      'forgot password returns message': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.message || b.success);
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 3);
  });
}

export function testResetPasswordFlow(token, csrfToken, cookies) {
  group('Authentication - Reset Password', function () {
    const resetToken = 'test_reset_token_' + Date.now();
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.auth.resetPassword}`,
      JSON.stringify({
        token: resetToken,
        password: 'NewPassword@123',
        confirmPassword: 'NewPassword@123',
      }),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'reset-password' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'reset-password' });
    checkResponse(resp, 200, {
      'reset password response valid': (r) => r.status >= 200 && r.status < 500,
    });
    simulateThinkTime(1, 2);
  });
}

export function testVerifyEmailFlow(token, csrfToken, cookies) {
  group('Authentication - Verify Email', function () {
    const verificationToken = 'verify_' + Date.now();
    const resp = http.post(
      `${CONFIG.baseUrl}${CONFIG.endpoints.auth.verifyEmail}`,
      JSON.stringify({ token: verificationToken }),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'verify-email' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'verify-email' });
    checkResponse(resp, 200, {
      'verify email response valid': (r) => r.status >= 200 && r.status < 500,
    });
    simulateThinkTime(1, 2);
  });
}

export function runAllAuthTests(token, csrfToken, cookies) {
  group('Authentication - Full Suite', function () {
    testCsrfTokenGeneration(token, csrfToken, cookies);
    testRegistrationFlow(token, csrfToken, cookies);
    testLoginFlow(token, csrfToken, cookies);
    token = testTokenRefresh(token, csrfToken, cookies);
    testForgotPasswordFlow(token, csrfToken, cookies);
    testResetPasswordFlow(token, csrfToken, cookies);
    testVerifyEmailFlow(token, csrfToken, cookies);
    testLogoutFlow(token, csrfToken, cookies);
  });
}
