const jwt = require('jsonwebtoken');

const {
  verifyAccessToken,
  verifyRefreshToken,
  getAccessSecret,
  getRefreshSecret,
} = require('../../src/utils/tokens');

describe('Token type validation', () => {
  describe('verifyAccessToken', () => {
    it('rejects a token with no typ claim', () => {
      const token = jwt.sign(
        {
          id: 123,
          role: 'USER',
        },
        getAccessSecret(),
        {
          algorithm: 'HS256',
        }
      );

      expect(() => verifyAccessToken(token)).toThrow(
        'Token type mismatch: expected access'
      );
    });
  });

  describe('verifyRefreshToken', () => {
    it('rejects a token with no typ claim', () => {
      const token = jwt.sign(
        {
          id: 123,
        },
        getRefreshSecret(),
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
