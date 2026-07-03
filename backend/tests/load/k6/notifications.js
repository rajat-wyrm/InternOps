import { check, sleep, group } from 'k6';
import http from 'k6/http';
import { CONFIG } from '../config.js';
import { generateNotification } from '../generators/data-generator.js';
import {
  checkResponse,
  simulateThinkTime,
  generateHeaders,
  errorRate,
  requestDuration,
  apiCalls,
} from './setup.js';

export const NOTIFICATIONS_OPTIONS = { tags: { module: 'notifications' } };

export function testListNotifications(token, csrfToken, cookies) {
  group('Notifications - List', function () {
    const params = {
      page: 1,
      limit: [10, 20, 50, 100][Math.floor(Math.random() * 4)],
      type: ['info', 'warning', 'error', 'success'][
        Math.floor(Math.random() * 4)
      ],
      read: [true, false, ''][Math.floor(Math.random() * 3)],
      sort: 'createdAt',
      order: 'desc',
    };
    const queryString = Object.entries(params)
      .filter(([_, v]) => v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.notifications.list}?${queryString}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'list-notifications' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'list-notifications',
    });
    checkResponse(resp, 200, {
      'notification list returns data': (r) => {
        try {
          const b = JSON.parse(r.body);
          return !!(b.data || b.notifications || b.rows || Array.isArray(b));
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function testMarkNotificationRead(token, csrfToken, cookies) {
  group('Notifications - Mark Read', function () {
    const id = Math.floor(Math.random() * 1000) + 1;
    const resp = http.put(
      `${CONFIG.baseUrl}${CONFIG.endpoints.notifications.markRead(id)}`,
      JSON.stringify({}),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'mark-notification-read' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'mark-notification-read',
    });
    checkResponse(resp, 200, {
      'mark read returns 200 or 404': (r) =>
        r.status === 200 || r.status === 404,
    });
    simulateThinkTime(1, 2);
  });
}

export function testMarkAllNotificationsRead(token, csrfToken, cookies) {
  group('Notifications - Mark All Read', function () {
    const resp = http.put(
      `${CONFIG.baseUrl}${CONFIG.endpoints.notifications.markAllRead}`,
      JSON.stringify({}),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'mark-all-read' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, { endpoint: 'mark-all-read' });
    checkResponse(resp, 200, {
      'mark all read returns success': (r) => {
        try {
          const b = JSON.parse(r.body);
          return b.success !== false || b.status === 'ok';
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function testNotificationCount(token, csrfToken, cookies) {
  group('Notifications - Count', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.notifications.count}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'notification-count' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'notification-count',
    });
    checkResponse(resp, 200, {
      'count returns number': (r) => {
        try {
          const b = JSON.parse(r.body);
          return (
            b.count !== undefined ||
            b.total !== undefined ||
            b.unread !== undefined
          );
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function testNotificationSettings(token, csrfToken, cookies) {
  group('Notifications - Settings', function () {
    const resp = http.get(
      `${CONFIG.baseUrl}${CONFIG.endpoints.notifications.settings}`,
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'notification-settings' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'notification-settings',
    });
    checkResponse(resp, 200, {
      'settings returns config': (r) => {
        try {
          const b = JSON.parse(r.body);
          return b.data !== undefined || b.settings !== undefined;
        } catch (e) {
          return false;
        }
      },
    });
    simulateThinkTime(1, 2);
  });
}

export function testUpdateNotificationSettings(token, csrfToken, cookies) {
  group('Notifications - Update Settings', function () {
    const settings = {
      emailNotifications: Math.random() > 0.5,
      pushNotifications: Math.random() > 0.5,
      inAppNotifications: true,
      digestFrequency: ['instant', 'hourly', 'daily', 'weekly'][
        Math.floor(Math.random() * 4)
      ],
      quietHoursEnabled: Math.random() > 0.7,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      categories: ['GENERAL', 'URGENT', 'INFO'],
    };
    const resp = http.put(
      `${CONFIG.baseUrl}${CONFIG.endpoints.notifications.settings}`,
      JSON.stringify(settings),
      {
        headers: generateHeaders(token, csrfToken),
        cookies: cookies || {},
        tags: { name: 'update-notification-settings' },
      }
    );
    apiCalls.add(1);
    requestDuration.add(resp.timings.duration, {
      endpoint: 'update-notification-settings',
    });
    checkResponse(resp, 200, {
      'settings updated': (r) => r.status === 200 || r.status === 201,
    });
    simulateThinkTime(1, 2);
  });
}

export function runAllNotificationTests(token, csrfToken, cookies) {
  group('Notifications - Full Suite', function () {
    testListNotifications(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testNotificationCount(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testMarkNotificationRead(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testMarkAllNotificationsRead(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testNotificationSettings(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
    testUpdateNotificationSettings(token, csrfToken, cookies);
    simulateThinkTime(1, 2);
  });
}
