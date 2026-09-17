const Fastify = require('fastify');
const {
  sanitizeInput,
  sanitizationMiddleware,
  isExcludedField,
  isAuthRoute,
} = require('../../src/middleware/sanitize');

describe('Sanitization Middleware Unit Tests (Issue #1466)', () => {
  describe('Sensitive Fields & Authentication Secrets Preservation', () => {
    it('1. password containing "&" remains unchanged', () => {
      const input = {
        password: 'P@ss&word123&more',
      };
      sanitizeInput(input);
      expect(input.password).toBe('P@ss&word123&more');
    });

    it('2. password containing "<" and ">" remains unchanged', () => {
      const input = {
        password: 'P@ss&123<abc>',
      };
      sanitizeInput(input);
      expect(input.password).toBe('P@ss&123<abc>');
    });

    it('3. newPassword remains unchanged', () => {
      const input = {
        newPassword: 'My<New>&Password=',
      };
      sanitizeInput(input);
      expect(input.newPassword).toBe('My<New>&Password=');
    });

    it('4. oldPassword remains unchanged if supported', () => {
      const input = {
        oldPassword: 'Old<Pass>&123!#',
        oldpassword: 'old<pass>&123!#',
      };
      sanitizeInput(input);
      expect(input.oldPassword).toBe('Old<Pass>&123!#');
      expect(input.oldpassword).toBe('old<pass>&123!#');
    });

    it('5. confirmPassword remains unchanged if supported', () => {
      const input = {
        confirmPassword: 'My<New>&Password=',
        confirmpassword: 'my<new>&password=',
      };
      sanitizeInput(input);
      expect(input.confirmPassword).toBe('My<New>&Password=');
      expect(input.confirmpassword).toBe('my<new>&password=');
    });

    it('6. token containing "+", "/" and "=" remains unchanged', () => {
      const input = {
        token: 'abc+/xyz==',
      };
      sanitizeInput(input);
      expect(input.token).toBe('abc+/xyz==');
    });

    it('7. refreshToken containing Base64 padding "==" remains unchanged', () => {
      const input = {
        refreshToken: 'eyJhbGciOiJIUzI1NiJ9==',
        refreshtoken: 'eyJhbGciOiJIUzI1NiJ9==',
      };
      sanitizeInput(input);
      expect(input.refreshToken).toBe('eyJhbGciOiJIUzI1NiJ9==');
      expect(input.refreshtoken).toBe('eyJhbGciOiJIUzI1NiJ9==');
    });

    it('8. reset/verification/access/csrf tokens remain unchanged if those fields exist', () => {
      const input = {
        resetToken: 'reset<token>&123==',
        resettoken: 'reset<token>&123==',
        verificationToken: 'verify+/token<abc>==',
        verificationtoken: 'verify+/token<abc>==',
        accessToken: 'access+/token<123>&==',
        accesstoken: 'access+/token<123>&==',
        csrfToken: 'csrf<tok>&123==',
        csrftoken: 'csrf<tok>&123==',
        _csrf: 'csrf<secret>&==',
        apiKey: 'key<123>&abc',
        clientSecret: 'secret<123>&xyz',
      };
      sanitizeInput(input);
      expect(input.resetToken).toBe('reset<token>&123==');
      expect(input.resettoken).toBe('reset<token>&123==');
      expect(input.verificationToken).toBe('verify+/token<abc>==');
      expect(input.verificationtoken).toBe('verify+/token<abc>==');
      expect(input.accessToken).toBe('access+/token<123>&==');
      expect(input.accesstoken).toBe('access+/token<123>&==');
      expect(input.csrfToken).toBe('csrf<tok>&123==');
      expect(input.csrftoken).toBe('csrf<tok>&123==');
      expect(input._csrf).toBe('csrf<secret>&==');
      expect(input.apiKey).toBe('key<123>&abc');
      expect(input.clientSecret).toBe('secret<123>&xyz');
    });

    it('9. normal user-generated fields such as title/description/content/comment/bio/feedback are still sanitized', () => {
      const input = {
        title: 'Title <script>alert("xss")</script>',
        description: 'Description with <img src=x onerror=alert(1)> tags',
        content: 'Content <b>bold</b> and <a href="http://evil.com">link</a>',
        comment: 'Comment <script>evil()</script>',
        message: 'Message <style>body{color:red}</style>text',
        bio: 'Bio <script>alert(1)</script>',
        feedback: 'Feedback <script>steal()</script>good',
        subject: 'Subject <iframe src="evil.com"></iframe>hello',
        body: 'Body <script>alert(2)</script>content',
        full_name: 'Jane <a href="http://evil.com">Doe</a>',
        notes: 'Line 1\n<b>bold</b>\nLine 2',
      };
      sanitizeInput(input);
      expect(input.title).toBe('Title ');
      expect(input.description).toBe('Description with  tags');
      expect(input.content).toBe('Content bold and link');
      expect(input.comment).toBe('Comment ');
      expect(input.message).toBe('Message text');
      expect(input.bio).toBe('Bio ');
      expect(input.feedback).toBe('Feedback good');
      expect(input.subject).toBe('Subject hello');
      expect(input.body).toBe('Body content');
      expect(input.full_name).toBe('Jane Doe');
      expect(input.notes).toBe('Line 1\nbold\nLine 2');
    });

    it('12. nested objects/arrays behave correctly with recursive sanitization while preserving sensitive fields', () => {
      const input = {
        user: {
          password: 'P@ss&123<abc>',
          newPassword: 'My<New>&Password=',
          bio: 'Hello <script>alert("xss")</script> World',
          profile: {
            refreshToken: 'eyJhbGciOiJIUzI1NiJ9==',
            notes: '<b>Important</b> note',
          },
        },
        users: [
          {
            email: 'user1@example.com',
            password: 'pass<123>&admin',
            title: 'Engineer <script>alert(1)</script>',
          },
          {
            email: 'user2@example.com',
            password: 'pass<456>&user',
            title: 'Designer <b>lead</b>',
          },
        ],
        tags: ['<script>xss</script>tag1', 'tag2 <b>bold</b>'],
      };

      sanitizeInput(input);

      expect(input.user.password).toBe('P@ss&123<abc>');
      expect(input.user.newPassword).toBe('My<New>&Password=');
      expect(input.user.bio).toBe('Hello  World');
      expect(input.user.profile.refreshToken).toBe('eyJhbGciOiJIUzI1NiJ9==');
      expect(input.user.profile.notes).toBe('Important note');

      expect(input.users[0].password).toBe('pass<123>&admin');
      expect(input.users[0].title).toBe('Engineer ');
      expect(input.users[1].password).toBe('pass<456>&user');
      expect(input.users[1].title).toBe('Designer lead');

      expect(input.tags[0]).toBe('tag1');
      expect(input.tags[1]).toBe('tag2 bold');
    });
  });

  describe('sanitizationMiddleware Route Bypass and Processing with Fastify', () => {
    let app;

    beforeAll(async () => {
      app = Fastify();
      app.addHook('preHandler', sanitizationMiddleware);

      // Auth routes
      app.post('/api/v1/auth/login', async (request) => ({
        body: request.body,
        query: request.query,
      }));

      app.post('/api/v1/auth/register', async (request) => ({
        body: request.body,
        query: request.query,
      }));

      app.post('/api/v1/auth/reset-password', async (request) => ({
        body: request.body,
        query: request.query,
      }));

      app.post('/auth/custom-endpoint', async (request) => ({
        body: request.body,
        query: request.query,
      }));

      // Non-auth routes
      app.post('/api/v1/users/profile', async (request) => ({
        body: request.body,
        query: request.query,
      }));

      app.post('/api/v1/notices', async (request) => ({
        body: request.body,
        query: request.query,
      }));
    });

    afterAll(async () => {
      await app.close();
    });

    it('10. auth routes bypass sanitization entirely', async () => {
      const loginPayload = {
        email: 'admin@example.com',
        password: 'P@ss&123<abc>',
      };

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login?token=abc%2B/xyz==',
        payload: loginPayload,
      });

      expect(loginRes.statusCode).toBe(200);
      const loginData = JSON.parse(loginRes.body);
      expect(loginData.body.password).toBe('P@ss&123<abc>');
      expect(loginData.query.token).toBe('abc+/xyz==');

      const registerPayload = {
        email: 'user<test>@example.com',
        password: 'My<Secret>&Pass==',
        full_name: '<b>Admin User</b>',
      };

      const registerRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: registerPayload,
      });

      expect(registerRes.statusCode).toBe(200);
      const registerData = JSON.parse(registerRes.body);
      // Auth routes completely bypass sanitization
      expect(registerData.body.password).toBe('My<Secret>&Pass==');
      expect(registerData.body.full_name).toBe('<b>Admin User</b>');

      const resetPayload = {
        token: 'eyJhbGciOiJIUzI1NiJ9==',
        newPassword: 'My<New>&Password=',
      };

      const resetRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: resetPayload,
      });

      expect(resetRes.statusCode).toBe(200);
      const resetData = JSON.parse(resetRes.body);
      expect(resetData.body.token).toBe('eyJhbGciOiJIUzI1NiJ9==');
      expect(resetData.body.newPassword).toBe('My<New>&Password=');
    });

    it('11. non-auth routes still perform sanitization where expected', async () => {
      const userPayload = {
        bio: 'Hello <script>alert("xss")</script> World',
        title: 'Senior <img src=x onerror=alert(1)> Engineer',
        password: 'P@ss&123<abc>', // Sensitive field still protected even on non-auth route
      };

      const userRes = await app.inject({
        method: 'POST',
        url: '/api/v1/users/profile?comment=%3Cb%3ENice%3C/b%3E',
        payload: userPayload,
      });

      expect(userRes.statusCode).toBe(200);
      const userData = JSON.parse(userRes.body);
      expect(userData.body.bio).toBe('Hello  World');
      expect(userData.body.title).toBe('Senior  Engineer');
      expect(userData.body.password).toBe('P@ss&123<abc>');
      expect(userData.query.comment).toBe('Nice');

      const noticePayload = {
        title: '<b>Important</b> Announcement',
        description:
          'Check <a href="http://evil.com">this</a> out <script>steal()</script>',
      };

      const noticeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/notices',
        payload: noticePayload,
      });

      expect(noticeRes.statusCode).toBe(200);
      const noticeData = JSON.parse(noticeRes.body);
      expect(noticeData.body.title).toBe('Important Announcement');
      expect(noticeData.body.description).toBe('Check this out ');
    });
  });

  describe('isAuthRoute Helper Tests', () => {
    it('correctly identifies auth route URLs', () => {
      expect(isAuthRoute({ routerPath: '/api/v1/auth/login' })).toBe(true);
      expect(isAuthRoute({ routerPath: '/api/v1/auth/register' })).toBe(true);
      expect(isAuthRoute({ routerPath: '/api/v1/auth/reset-password' })).toBe(
        true
      );
      expect(
        isAuthRoute({ routeOptions: { url: '/api/v1/auth/refresh' } })
      ).toBe(true);
      expect(isAuthRoute({ url: '/auth/login' })).toBe(true);
      expect(isAuthRoute({ routerPath: '/api/v1/users' })).toBe(false);
      expect(isAuthRoute({ routerPath: '/api/v1/meetings' })).toBe(false);
      expect(isAuthRoute(null)).toBe(false);
      expect(isAuthRoute({})).toBe(false);
    });
  });
});
