describe('Security Error Logging (#1012)', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('logs warning on WebSocket JWT verification failure with safe token details', () => {
    jest.resetModules();
    const mockVerifyAccessToken = jest.fn(() => {
      throw new Error('invalid token');
    });
    const use = jest.fn();
    const on = jest.fn();
    jest.doMock('../../src/utils/tokens', () => ({
      verifyAccessToken: mockVerifyAccessToken,
    }));
    jest.doMock('socket.io', () => ({
      Server: jest.fn().mockImplementation(() => ({
        use,
        on,
      })),
    }));
    const { initializeWebSocket } = require('../../src/websocket');
    const logger = {
      warn: jest.fn(),
      info: jest.fn(),
    };
    initializeWebSocket({}, logger);
    const authMiddleware = use.mock.calls[0][0];
    const socket = {
      handshake: {
        auth: { token: 'bad.jwt.token' },
        headers: { 'x-forwarded-for': '203.0.113.10' },
        address: '10.0.0.50',
      },
      disconnect: jest.fn(),
    };
    const next = jest.fn();
    authMiddleware(socket, next);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        clientIp: '203.0.113.10',
        hasToken: true,
        tokenLength: 'bad.jwt.token'.length,
        tokenSegments: 3,
      }),
      'WebSocket authentication failed during token verification'
    );
    const [warnDetails] = logger.warn.mock.calls[0];
    expect(warnDetails).not.toHaveProperty('token');
    expect(warnDetails).not.toHaveProperty('rawToken');
    expect(JSON.stringify(warnDetails)).not.toContain('bad.jwt.token');
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Authentication error');
  });

  it('logs warning on CSRF token generation when bearer verification throws', () => {
    jest.resetModules();
    jest.doMock('../../src/utils/tokens', () => ({
      verifyAccessToken: jest.fn(() => {
        throw new Error('jwt malformed');
      }),
    }));
    const { generateToken } = require('../../src/middleware/csrf');
    const request = {
      method: 'GET',
      url: '/api/auth/csrf',
      headers: {
        authorization: 'Bearer malformed.jwt.token',
      },
      log: {
        warn: jest.fn(),
      },
    };
    const reply = {
      setCookie: jest.fn(),
    };
    const token = generateToken(request, reply);
    expect(typeof token).toBe('string');
    expect(request.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/api/auth/csrf',
        hasAuthHeader: true,
        tokenLength: 'malformed.jwt.token'.length,
      }),
      'CSRF bearer token verification failed while generating CSRF token'
    );
    const [warnDetails] = request.log.warn.mock.calls[0];
    expect(warnDetails).not.toHaveProperty('token');
    expect(warnDetails).not.toHaveProperty('authorization');
    expect(JSON.stringify(warnDetails)).not.toContain('malformed.jwt.token');
  });

  it('logs warning and does not short-circuit when bearer verification fails during check', async () => {
    jest.resetModules();
    jest.doMock('../../src/utils/tokens', () => ({
      verifyAccessToken: jest.fn(() => {
        throw new Error('invalid signature');
      }),
    }));
    const { csrfMiddleware, _internal } = require('../../src/middleware/csrf');
    const bootstrapReply = { setCookie: jest.fn() };
    _internal.writeSession(bootstrapReply, 'session-123', 'user-1');
    const sessionCookie = bootstrapReply.setCookie.mock.calls.find(
      ([name]) => name === 'csrf-sid'
    )[1];
    const request = {
      method: 'POST',
      url: '/api/users/me',
      headers: {
        cookie: `csrf-sid=${encodeURIComponent(sessionCookie)}`,
        'x-csrf-token': _internal.tokenFor('session-123'),
        authorization: 'Bearer bad.jwt.token',
      },
      log: {
        warn: jest.fn(),
      },
    };
    const reply = {
      setCookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    await csrfMiddleware(request, reply);
    expect(request.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/api/users/me',
        hasAuthHeader: true,
        tokenLength: 'bad.jwt.token'.length,
      }),
      'CSRF bearer token verification failed during request validation'
    );
    const [warnDetails] = request.log.warn.mock.calls[0];
    expect(warnDetails).not.toHaveProperty('token');
    expect(warnDetails).not.toHaveProperty('authorization');
    expect(JSON.stringify(warnDetails)).not.toContain('bad.jwt.token');

    // A malformed bearer token during CSRF validation must NOT short-circuit

    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
    expect(reply.setCookie).not.toHaveBeenCalled();
  });
});
