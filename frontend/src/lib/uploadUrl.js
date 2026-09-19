// Resolves server-relative upload paths (e.g. "/uploads/avatar_x.png")
// against the API origin so images load correctly when the frontend is
// served from a different origin than the backend (e.g. Cloudflare
// Worker frontend + Render API in production).
//
// Why this exists: `avatar_url` is stored in the DB as a root-relative
// path. Rendering it raw makes the browser request the image from the
// FRONTEND origin, where an SPA fallback returns index.html (200 +
// text/html) instead of the file — a soft 404. Local dev never shows
// this because vite.config.js proxies /uploads to the backend.

function getApiOrigin() {
  const raw = import.meta.env.VITE_API_URL;
  if (!raw) return ''; // dev server proxies /uploads — keep paths relative

  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }

  return url
    .replace(/\/+$/, '')
    .replace(/\/api(?:\/v\d+)?$/i, '')
    .replace(/\/+$/, '');
}

export function resolveUploadUrl(path) {
  if (!path || typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed; // already absolute

  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (!normalizedPath.startsWith('/uploads/')) return trimmed; // keep frontend public assets like /admin-default-avatar.svg relative

  const origin = getApiOrigin();
  return origin ? `${origin}${normalizedPath}` : normalizedPath;
}

export default resolveUploadUrl;
