'use strict';

const app = require('../../src/app');
const { generateAccessToken } = require('../../src/utils/tokens');
const authRepository = require('../../src/modules/auth/repository');

describe('Chatbot API Integration Tests', () => {
  let internToken;
  let internUser;

  beforeAll(async () => {
    // Mock getPasswordAccessState to allow testing without live Postgres connection
    jest.spyOn(authRepository, 'getPasswordAccessState').mockResolvedValue({
      must_change_password: false,
      suspended: false,
    });

    await app.ready();

    internUser = {
      id: '00000000-0000-0000-0000-000000000001',
      role: 'INTERN',
    };
    internToken = generateAccessToken(internUser);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/chatbot/message', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chatbot/message',
        headers: { 'Content-Type': 'application/json' },
        payload: { message: 'How do I start my internship?' },
      });

      expect([401, 403]).toContain(res.statusCode);
    });

    it('should return 200 and AIML response for onboarding query', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chatbot/message',
        headers: {
          Authorization: `Bearer ${internToken}`,
          'Content-Type': 'application/json',
        },
        payload: { message: 'How do I start my internship?' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('response');
      expect(body).toHaveProperty('source', 'aiml');
      expect(body.response).toMatch(/internship|internops|onboarding/i);
    });

    it('should return 200 and AIML response for workflow submission query', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chatbot/message',
        headers: {
          Authorization: `Bearer ${internToken}`,
          'Content-Type': 'application/json',
        },
        payload: { message: 'How do I submit my work?' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.source).toBe('aiml');
      expect(body.response).toMatch(/tasks|upload proof|submit/i);
    });

    it('should return 200 and safe fallback for unknown queries', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chatbot/message',
        headers: {
          Authorization: `Bearer ${internToken}`,
          'Content-Type': 'application/json',
        },
        payload: { message: 'Tell me about quantum computing.' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.source).toBe('fallback');
      expect(body.response).toBe(
        'I’m not sure about that yet. Please try rephrasing your question or contact your mentor/support team.'
      );
    });

    it('should return 400 Bad Request for empty string message', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chatbot/message',
        headers: {
          Authorization: `Bearer ${internToken}`,
          'Content-Type': 'application/json',
        },
        payload: { message: '' },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('error');
    });

    it('should return 400 Bad Request when message property is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chatbot/message',
        headers: {
          Authorization: `Bearer ${internToken}`,
          'Content-Type': 'application/json',
        },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/chatbot/message (Alias Route)', () => {
    it('should handle queries at the /api/chatbot alias prefix', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chatbot/message',
        headers: {
          Authorization: `Bearer ${internToken}`,
          'Content-Type': 'application/json',
        },
        payload: { message: 'What is the attendance policy?' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.source).toBe('aiml');
      expect(body.response).toMatch(/attendance/i);
    });
  });
});
