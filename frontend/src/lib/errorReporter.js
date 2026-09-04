import api from './axios';

const REPORT_THROTTLE_MS = 60 * 1000;
let lastReportTime = 0;

export async function reportClientError(error, errorInfo) {
  const now = Date.now();

  if (now - lastReportTime < REPORT_THROTTLE_MS) {
    return;
  }

  lastReportTime = now;

  try {
    const currentUrl = new URL(window.location.href);

    await api.post('/client-error', {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      url: `${currentUrl.origin}${currentUrl.pathname}`,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to report client error:', err);
  }
}
