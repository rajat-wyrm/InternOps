const crypto = require('crypto');
function generateToken() { return crypto.randomBytes(32).toString('hex'); }
const EXEMPT = ['/api/auth/login','/api/auth/refresh','/api/auth/forgot-password','/api/auth/reset-password'];
function csrfProtection(request, reply, done) {
  if (['GET','HEAD','OPTIONS'].includes(request.method)) return done();
  if (EXEMPT.some(p => request.url.startsWith(p))) return done();
  
  const tokenFromHeader = request.headers['x-xsrf-token'] || request.headers['x-csrf-token'];
  const tokenFromCookie = request.cookies['XSRF-TOKEN'];
  
  if (!tokenFromHeader || !tokenFromCookie || tokenFromHeader !== tokenFromCookie) {
    return reply.status(403).send({ error: 'CSRF token verification failed' });
  }
  done();
}
module.exports = { generateToken, csrfProtection };