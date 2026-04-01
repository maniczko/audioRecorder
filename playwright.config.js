// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,

  // Retry failed tests in CI to handle flakiness
  retries: process.env.CI ? 2 : 0,

  // Use multiple workers for parallel test execution
  workers: process.env.CI ? 2 : 1,

  // Timeout settings
  timeout: 90_000, // 90 seconds per test (increased from 60s)
  expect: {
    timeout: 20_000, // 20 seconds for expect assertions (increased from 10s)
  },

  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure', // Keep trace for debugging
    screenshot: 'only-on-failure',
    video: 'retain-on-failure', // Keep video for debugging
    actionTimeout: 20_000, // 20 seconds for actions like click, fill, etc. (increased from 15s)

    // Launch options for better stability
    launchOptions: {
      slowMo: process.env.CI ? 500 : 0, // Slow down actions in CI
    },
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
