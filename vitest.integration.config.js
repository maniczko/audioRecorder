import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/App.integration.test.tsx'],
    maxWorkers: 1,
    poolOptions: {
      forks: {
        maxForks: 1,
        minForks: 1,
      },
    },
    clearMocks: true,
    restoreMocks: true,
    fakeTimers: {
      toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'],
    },
  },
});
