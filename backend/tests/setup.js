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
