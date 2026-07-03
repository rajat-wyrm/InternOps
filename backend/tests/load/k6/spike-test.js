import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { CONFIG } from '../config.js';

const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');

export const options = {
  stages: CONFIG.stages.spike,
  thresholds: CONFIG.thresholds.stress,
};

export default function () {
  group('Spike Test', function () {
    const endpoints = [
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.stats}`,
        name: 'dashboard-stats',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.summary}`,
        name: 'dashboard-summary',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.interns.list}?page=1&limit=20`,
        name: 'intern-list',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.interns.stats}`,
        name: 'intern-stats',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.interns.search}?q=engineering`,
        name: 'intern-search',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.attendance.today}`,
        name: 'attendance-today',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.attendance.stats}`,
        name: 'attendance-stats',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.progress.stats}`,
        name: 'progress-stats',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.mentors.list}`,
        name: 'mentor-list',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.mentors.myInterns}`,
        name: 'my-interns',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.notifications.count}`,
        name: 'notif-count',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.notifications.list}`,
        name: 'notif-list',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.sessions.current}`,
        name: 'current-session',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.auth.csrfToken}`,
        name: 'csrf-token',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.charts}?period=monthly`,
        name: 'charts',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.analytics}`,
        name: 'analytics',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.dashboard.recentActivity}`,
        name: 'recent-activity',
      },
      {
        method: 'GET',
        url: `${CONFIG.baseUrl}${CONFIG.endpoints.reports.list}`,
        name: 'report-list',
      },
    ];

    const batch = endpoints.map((ep) => {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      return [
        'GET',
        `${ep.url}`,
        null,
        { headers, tags: { name: ep.name, type: 'spike' } },
      ];
    });

    const responses = http.batch(batch);
    let successCount = 0;
    for (const resp of responses) {
      requestDuration.add(resp.timings.duration);
      if (resp.status < 400) successCount++;
      else errorRate.add(1);
    }

    check(responses[0], {
      'spike batch completed': () => true,
      'spike success rate above 80%': () =>
        successCount / responses.length >= 0.8,
    });
  });

  sleep(1);
}
