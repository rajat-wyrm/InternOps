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

  return url.replace(/\/+$/, '').replace(/\/api\/v\d+$/i, '');
}

export function resolveUploadUrl(path) {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/i.test(path)) return path; // already absolute
  if (!path.startsWith('/uploads/')) return path; // keep frontend public assets like /admin-default-avatar.svg relative

  const origin = getApiOrigin();
  return origin ? `${origin}${path}` : path;
}

export default resolveUploadUrl;
