module.exports = {
  testEnvironment: 'node',

  testMatch: ['**/tests/**/*.test.js'],

  verbose: true,

  forceExit: true,

  detectOpenHandles: true,

  maxWorkers: 1,

  globalSetup: '<rootDir>/tests/globalSetup.js',

  globalTeardown: '<rootDir>/tests/globalTeardown.js',

  // Load environment variables before Jest starts tests
  setupFiles: ['<rootDir>/tests/envSetup.js'],

  // Existing mocks and Jest setup
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

  // Pick a consistent timeout (60s for CI stability)
  testTimeout: 60000,

  // Added mapping so tests don’t fail when ai-service is missing
  moduleNameMapper: {
    '^../../../ai-service/(.*)$': '<rootDir>/tests/__mocks__/ai-service/$1',
  },

  // sanitize-html depends on htmlparser2, which ships an ESM-only build.
  // Jest ignores node_modules for transformation by default — this
  // carves out an exception so those two packages get transpiled to
  // CommonJS via babel-jest instead of failing to parse.
  transformIgnorePatterns: ['node_modules/(?!(sanitize-html|htmlparser2)/)'],
};
