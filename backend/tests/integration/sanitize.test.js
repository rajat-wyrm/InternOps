const Fastify = require('fastify');
const {
  sanitizeInput,
  sanitizationMiddleware,
  isExcludedField,
} = require('../../src/middleware/sanitize');

describe('Sanitization Middleware & Helper Tests', () => {
  describe('isExcludedField Helper', () => {
    it('should exclude passwords', () => {
      expect(isExcludedField('password')).toBe(true);
      expect(isExcludedField('oldPassword')).toBe(true);
      expect(isExcludedField('newPassword')).toBe(true);
      expect(isExcludedField('confirmPassword')).toBe(true);
    });

    it('should exclude tokens and secrets', () => {
      expect(isExcludedField('token')).toBe(true);
      expect(isExcludedField('resetToken')).toBe(true);
      expect(isExcludedField('accessToken')).toBe(true);
      expect(isExcludedField('apiKey')).toBe(true);
      expect(isExcludedField('clientSecret')).toBe(true);
    });

    it('should exclude emails', () => {
      expect(isExcludedField('email')).toBe(true);
      expect(isExcludedField('recipient_email')).toBe(true);
    });

    it('should exclude URLs and paths', () => {
      expect(isExcludedField('url')).toBe(true);
      expect(isExcludedField('avatar_url')).toBe(true);
      expect(isExcludedField('thumbnail_url')).toBe(true);
      expect(isExcludedField('pdf_path')).toBe(true);
      expect(isExcludedField('redirectUri')).toBe(true);
    });

    it('should NOT exclude text fields like bio, notes, title, etc.', () => {
      expect(isExcludedField('bio')).toBe(false);
      expect(isExcludedField('notes')).toBe(false);
      expect(isExcludedField('reason')).toBe(false);
      expect(isExcludedField('full_name')).toBe(false);
      expect(isExcludedField('title')).toBe(false);
      expect(isExcludedField('description')).toBe(false);
      expect(isExcludedField('content')).toBe(false);
    });

    it('should NOT exclude innocent field names containing key or secret substrings', () => {
      expect(isExcludedField('monkey')).toBe(false);
      expect(isExcludedField('keyboard')).toBe(false);
      expect(isExcludedField('secretary')).toBe(false);
      expect(isExcludedField('secret_question')).toBe(false);
    });
  });

  describe('sanitizeInput Helper directly', () => {
    it('should strip HTML tags from non-excluded fields by default', () => {
      const input = {
        name: 'John <script>alert("xss")</script> Doe',
        bio: 'Hello <img src=x onerror=alert(1)> world',
        notes: 'Line 1\n<b>bold</b>\nLine 2',
        full_name: 'Jane <a href="http://evil.com">Doe</a>',
      };

      sanitizeInput(input);

      expect(input.name).toBe('John  Doe');
      expect(input.bio).toBe('Hello  world');
      expect(input.notes).toBe('Line 1\nbold\nLine 2');
      expect(input.full_name).toBe('Jane Doe');
    });

    it('should NOT strip HTML tags or escape entities in excluded fields', () => {
      const input = {
        password: 'my<secure&password',
        resetToken: 'abc<def&ghi',
        email: 'test<xss>@example.com',
        avatar_url: 'http://example.com/img<xss>.png?a=1&b=2',
      };

      sanitizeInput(input);

      expect(input.password).toBe('my<secure&password');
      expect(input.resetToken).toBe('abc<def&ghi');
      expect(input.email).toBe('test<xss>@example.com');
      expect(input.avatar_url).toBe('http://example.com/img<xss>.png?a=1&b=2');
    });

    it('should sanitize nested objects recursively', () => {
      const input = {
        user: {
          bio: 'My <script>alert(1)</script> bio',
          email: 'test<xss>@example.com',
        },
        items: [{ name: '<b>Item 1</b>' }],
      };

      sanitizeInput(input);

      expect(input.user.bio).toBe('My  bio');
      expect(input.user.email).toBe('test<xss>@example.com');
      expect(input.items[0].name).toBe('Item 1');
    });

    it('should sanitize arrays of strings directly', () => {
      const input = ['<script>alert("xss")</script>', 'Hello <b>world</b>'];
      sanitizeInput(input);
      expect(input[0]).toBe('');
      expect(input[1]).toBe('Hello world');
    });

    it('should handle non-string primitive values and null without throwing errors', () => {
      const input = {
        name: '<b>John</b>',
        age: 30,
        isActive: true,
        score: null,
        info: undefined,
        tags: ['<script>xss</script>', 100, false, null],
      };

      expect(() => sanitizeInput(input)).not.toThrow();
      expect(input.name).toBe('John');
      expect(input.age).toBe(30);
      expect(input.isActive).toBe(true);
      expect(input.score).toBe(null);
      expect(input.info).toBeUndefined();
      expect(input.tags[0]).toBe('');
      expect(input.tags[1]).toBe(100);
      expect(input.tags[2]).toBe(false);
      expect(input.tags[3]).toBe(null);
    });
  });

  describe('sanitizationMiddleware with Fastify', () => {
    let app;

    beforeAll(async () => {
      app = Fastify();
      app.addHook('preHandler', sanitizationMiddleware);

      app.post('/test', async (request, reply) => {
        return {
          body: request.body,
          query: request.query,
          params: request.params,
        };
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it('should sanitize request body, query, and params in the middleware', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/test?bio=Hello+%3Cb%3Eworld%3C/b%3E&password=my%3Csecure%26password',
        payload: {
          notes: 'Notes with <img src=x onerror=alert(1)> script',
          password: 'my<secure&password',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);

      expect(data.body.notes).toBe('Notes with  script');
      expect(data.body.password).toBe('my<secure&password');
      expect(data.query.bio).toBe('Hello world');
      expect(data.query.password).toBe('my<secure&password');
    });
  });
});
