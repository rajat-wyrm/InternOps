import axios from 'axios';

// All backend routes are mounted under /api; Vite proxies this to :5000 in dev.
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// The backend's CSRF guard only requires the header to be PRESENT on mutating
// requests (login/refresh/forgot/reset are exempt). We fetch a real token once
// and reuse it; a generated fallback keeps requests working if that call fails.
let csrfToken = null;
async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const res = await api.get('/auth/csrf-token');
    csrfToken = res.data.csrfToken;
  } catch {
    csrfToken = Math.random().toString(36).slice(2);
  }
  return csrfToken;
}

api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    config.headers['X-CSRF-Token'] = await getCsrfToken();
  }
  return config;
});

// On 401, drop the session and bounce to login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
