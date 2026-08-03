const {
  sanitizeInput,
  sanitizationMiddleware,
} = require('../../src/middleware/sanitize');

describe('Sanitize Middleware', () => {
  describe('sanitizeInput', () => {
    it('does not alter passwords containing & or <', () => {
      const input = {
        email: 'test@example.com',
        password: 'P@ssword&123<secret>',
        newPassword: 'My<New>&Pass=',
      };
      sanitizeInput(input);
      expect(input.password).toBe('P@ssword&123<secret>');
      expect(input.newPassword).toBe('My<New>&Pass=');
    });

    it('does not alter tokens or refresh tokens with base64 padding or special chars', () => {
      const input = {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9==',
        refreshToken: 'def456+789/abc==',
      };
      sanitizeInput(input);
      expect(input.token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9==');
      expect(input.refreshToken).toBe('def456+789/abc==');
    });

    it('sanitizes user-generated content fields (html/script tags)', () => {
      const input = {
        title: 'Title <script>alert(1)</script>',
        content: 'Hello <b>world</b> & friends',
        description: '<a href="javascript:void(0)">Click me</a>',
      };
      sanitizeInput(input);
      expect(input.title).toBe('Title ');
      expect(input.content).toBe('Hello world &amp; friends');
      expect(input.description).toBe('Click me');
    });

    it('ignores fields not in the allowlist', () => {
      const input = {
        role: 'ADMIN',
        departmentId: '1234-5678',
        customField: '<script>test</script>',
      };
      sanitizeInput(input);
      expect(input.role).toBe('ADMIN');
      expect(input.departmentId).toBe('1234-5678');
      expect(input.customField).toBe('<script>test</script>');
    });
  });

  describe('sanitizationMiddleware', () => {
    it('skips sanitization on auth routes', () => {
      const req = {
        url: '/api/v1/auth/login',
        body: {
          email: 'user@example.com',
          password: 'Pass&Word<123>',
          name: 'Name <script>',
        },
      };
      const reply = {};
      const done = jest.fn();

      sanitizationMiddleware(req, reply, done);

      expect(done).toHaveBeenCalled();
      expect(req.body.password).toBe('Pass&Word<123>');
      expect(req.body.name).toBe('Name <script>');
    });

    it('sanitizes allowed fields on non-auth routes', () => {
      const req = {
        url: '/api/v1/notices',
        body: {
          title: 'Notice <script>bad()</script>',
          content: 'Some & content',
          password: 'Unmodified&Pass<1>',
        },
        query: {
          search: 'Search & Query',
        },
        params: {},
      };
      const reply = {};
      const done = jest.fn();

      sanitizationMiddleware(req, reply, done);

      expect(done).toHaveBeenCalled();
      expect(req.body.title).toBe('Notice ');
      expect(req.body.content).toBe('Some &amp; content');
      expect(req.body.password).toBe('Unmodified&Pass<1>');
    });
  });
});
