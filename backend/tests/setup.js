jest.mock('argon2', () => {
  return {
    hash: jest.fn().mockImplementation(async (password) => {
      return `mocked_argon2_hash:${password}`;
    }),
    verify: jest.fn().mockImplementation(async (hash, password) => {
      // Seeded admin password check
      if (password === 'Admin@123' && hash && hash.startsWith('$argon2id$')) {
        return true;
      }
      // Generic mock hash check
      if (hash === `mocked_argon2_hash:${password}`) {
        return true;
      }
      // General fallback if the hash contains the password text
      if (hash && hash.includes(password)) {
        return true;
      }
      return false;
    }),
  };
});

// Suppress console logs during tests to keep the output clean
// especially from expected error cases (e.g. errorPaths.test.js)
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'info').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
