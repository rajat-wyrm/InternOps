const jwt = require('jsonwebtoken');

const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require('../../src/utils/tokens');

const config = require('../../src/config');

describe('Token utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyAccessToken()', () => {
    it('rejects a token when typ claim is missing', () => {
      const token = jwt.sign(
        {
          id: 'user-1',
          role: 'EMPLOYEE',
        },
        config.jwt.secret,
        {
          algorithm: 'HS256',
        }
      );

      expect(() => verifyAccessToken(token)).toThrow(
        'Token type mismatch: expected access'
      );
    });

    it('accepts a valid access token with typ=access', () => {
      const token = generateAccessToken({
        id: 'user-1',
        role: 'EMPLOYEE',
        department_id: null,
      });

      const decoded = verifyAccessToken(token);

      expect(decoded.typ).toBe('access');
      expect(decoded.id).toBe('user-1');
    });

    it('rejects a refresh token as an access token', () => {
      const token = jwt.sign(
        {
          id: 'user-1',
          typ: 'refresh',
        },
        config.jwt.secret,
        {
          algorithm: 'HS256',
        }
      );

      expect(() => verifyAccessToken(token)).toThrow(
        'Token type mismatch: expected access'
      );
    });
  });

  describe('verifyRefreshToken()', () => {
    it('rejects a token when typ claim is missing', () => {
      const token = jwt.sign(
        {
          id: 'user-1',
        },
        config.jwt.refreshSecret,
        {
          algorithm: 'HS256',
        }
      );

      expect(() => verifyRefreshToken(token)).toThrow(
        'Token type mismatch: expected refresh'
      );
    });

    it('accepts a valid refresh token with typ=refresh', () => {
      const token = generateRefreshToken({
        id: 'user-1',
      });

      const decoded = verifyRefreshToken(token);

      expect(decoded.typ).toBe('refresh');
      expect(decoded.id).toBe('user-1');
    });

    it('rejects an access token as a refresh token', () => {
      const token = jwt.sign(
        {
          id: 'user-1',
          typ: 'access',
        },
        config.jwt.refreshSecret,
        {
          algorithm: 'HS256',
        }
      );

      expect(() => verifyRefreshToken(token)).toThrow(
        'Token type mismatch: expected refresh'
      );
    });
  });
});
