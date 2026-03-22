import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage/server',
      include: ['server/**/*.{ts,js}'],
      exclude: [
        'server/tests/**/*.test.ts',
        'server/coverage/**',
        'server/scripts/**',
        'server/jest.config.js',
        'server/debug_users.ts',
        'server/test_scrypt.ts',
        'server/**/*.d.ts',
      ],
      thresholds: {
        lines: 20,
        functions: 23,
        statements: 20,
        branches: 16,
      },
      // Generate coverage even on test failures
      reportOnFailure: true,
      // Skip files that are only type definitions or setup
      skipFull: false,
    },
  },
})
