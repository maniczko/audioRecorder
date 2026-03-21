import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['src/App.integration.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage/frontend',
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/setupTests.ts', 'src/**/*.test.{js,jsx,ts,tsx}', 'src/App.integration.test.tsx'],
      thresholds: {
        lines: 28,
        functions: 30,
        statements: 28,
        branches: 22,
      },
    },
  },
});
