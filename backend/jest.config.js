module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverage: false,
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
      branches: 33,
      functions: 40,
      lines: 41,
      statements: 40,
    },
  },
  testTimeout: 30000,
};
