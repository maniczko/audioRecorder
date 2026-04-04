import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
    setupFiles: ['./server/tests/setup.ts'],
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
        'server/test_diarization.ts',
        'server/test_scrypt.ts',
        'server/**/*.d.ts',
        'server/**/*.test.ts',
        // Integration-heavy modules requiring external dependencies
        'server/debug_env.ts',
        'server/stt/localWhisper.ts',
        'server/agents/dispatcher.ts',
      ],
      thresholds: {
        lines: 65,
        functions: 70,
        statements: 65,
        branches: 55,
      },
      // Enforce thresholds - fail CI if not met
      enabled: true,
      // Generate coverage even on test failures
      reportOnFailure: true,
      // Skip files that are only type definitions or setup
      skipFull: false,
    },
  },
});
