import api from './axios';

let lastReportTime = 0;

export async function reportClientError(error, errorInfo) {
  const now = Date.now();

  // Rate-limit to one report every 30 seconds
  if (now - lastReportTime < 30000) {
    return;
  }

  lastReportTime = now;

  try {
    await api.post('/client-error', {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Never let error reporting crash the app
    console.error('Failed to report client error:', err);
  }
}
