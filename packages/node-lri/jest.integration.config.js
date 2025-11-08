const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: ['<rootDir>/tests/integration/**/*.integration.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/tests/ws-adapter.test.ts'],
};
