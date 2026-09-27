/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/middlewares/idempotency.ts',
    'src/middlewares/rateLimiter.ts',
    'src/services/**/*.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 65,
      lines: 65,
      statements: 65
    }
  },
  clearMocks: true,
  verbose: true
};
