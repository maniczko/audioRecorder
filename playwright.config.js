// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,

  // Retry failed tests in CI to handle flakiness
  retries: process.env.CI ? 1 : 0,

  // Use multiple workers for parallel test execution
  workers: process.env.CI ? 4 : 2,

  // Timeout settings
  timeout: 45_000, // 45 seconds per test
  expect: {
    timeout: 10_000, // 10 seconds for expect assertions
  },

  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure', // Keep trace for debugging
    screenshot: 'only-on-failure',
    video: 'retain-on-failure', // Keep video for debugging
    actionTimeout: 15_000, // 15 seconds for actions like click, fill, etc.
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Increase viewport for better visibility
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000, // 3 minutes for server startup
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      VITE_DATA_PROVIDER: 'local',
      VITE_MEDIA_PROVIDER: 'local',
      VITE_API_BASE_URL: 'http://localhost:4000',
      VITE_E2E_TEST: 'true',
    },
  },
});
