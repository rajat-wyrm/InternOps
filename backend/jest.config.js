module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  forceExit: true,
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/modules/auth/**/*.js',
    'src/modules/meetings/**/*.js',
    'src/modules/feature-flags/**/*.js',
    'src/middleware/**/*.js',
    'src/services/**/*.js',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testTimeout: 30000,
};
