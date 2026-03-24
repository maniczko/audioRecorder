import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['src/App.integration.test.tsx'],
    // Limit workers to avoid OOM
    maxWorkers: 4,
    // Increase memory limit
    poolOptions: {
      forks: {
        maxForks: 4,
        minForks: 1,
      },
    },
    // Clear mocks and restore state between tests
    clearMocks: true,
    restoreMocks: true,
    fakeTimers: {
      toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage/frontend',
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: [
        'src/setupTests.ts',
        'src/**/*.test.{js,jsx,ts,tsx}',
        'src/App.integration.test.tsx',
        'src/**/*.d.ts',
      ],
      thresholds: {
        lines: 28,
        functions: 30,
        statements: 28,
        branches: 22,
      },
      // Generate coverage even on test failures
      reportOnFailure: true,
      // Skip files that are only type definitions or setup
      skipFull: false,
    },
  },
});
