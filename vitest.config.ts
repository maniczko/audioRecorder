import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage/frontend',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/tests/**',
        'src/coverage/**',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        // Thresholds aligned with current actual coverage (~58-55%)
        // Raise gradually as test coverage improves
        lines: 55,
        functions: 50,
        statements: 55,
        branches: 48,
      },
      // Enforce thresholds - fail CI if not met
      enabled: true,
      // Generate coverage even on test failures
      reportOnFailure: true,
      // Skip files that are only type definitions or setup
      skipFull: false,
      // Fail immediately when threshold not met
      autoUpdate: false,
    },
  },
});
