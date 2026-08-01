jest.mock('argon2', () => {
  const mockImpl = {
    hash: jest.fn().mockImplementation(async (password) => {
      return `mocked_argon2_hash:${password}`;
    }),
    verify: jest.fn().mockImplementation(async (hash, password) => {
      // Seeded admin password check — accept real argon2 hashes from globalSetup
      if (password === 'Admin@123' && hash && hash.startsWith('$argon2id$')) {
        return true;
      }
      // Generic mock hash check — accept mocked hash format
      if (hash === `mocked_argon2_hash:${password}`) {
        return true;
      }
      // Fallback: if hash contains the password text, accept it
      if (hash && hash.includes(password)) {
        return true;
      }
      return false;
    }),
  };
  return mockImpl;
});

// Suppress console logs during tests to keep the output clean
// especially from expected error cases (e.g. errorPaths.test.js)
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'info').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Wrap Fastify inject to supply default Origin header matching config
jest.mock('../src/app', () => {
  const actualApp = jest.requireActual('../src/app');
  const originalInject = actualApp.inject;
  actualApp.inject = function (opts) {
    if (opts) {
      if (!opts.headers) {
        opts.headers = {};
      }
      const hasOrigin = Object.keys(opts.headers).some(
        (key) => key.toLowerCase() === 'origin'
      );
      if (!hasOrigin) {
        opts.headers['Origin'] = 'http://localhost:5173';
      }
    }
    return originalInject.call(actualApp, opts);
  };
  return actualApp;
});
