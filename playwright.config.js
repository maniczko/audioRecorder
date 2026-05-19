// @ts-check
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const apiBaseURL = process.env.PLAYWRIGHT_API_BASE_URL || baseURL;
const webCommand = process.env.PLAYWRIGHT_WEB_COMMAND || 'pnpm start';
const dataProvider = process.env.PLAYWRIGHT_DATA_PROVIDER || 'local';
const mediaProvider = process.env.PLAYWRIGHT_MEDIA_PROVIDER || 'local';
const includeRemoteApiProject = process.env.PLAYWRIGHT_INCLUDE_REMOTE_API === 'true';

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
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}-win32{ext}',

  use: {
    baseURL,
    trace: 'retain-on-failure', // Keep trace for debugging
    screenshot: 'only-on-failure',
    video: 'retain-on-failure', // Keep video for debugging
    actionTimeout: 15_000, // 15 seconds for actions like click, fill, etc.
  },

  projects: [
    {
      name: 'chromium',
      testIgnore: [/remote-api\.spec\.js/, /layout-visual\.spec\.js/],
      use: {
        ...devices['Desktop Chrome'],
        // Increase viewport for better visibility
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'remote-api',
      testMatch: includeRemoteApiProject ? /remote-api\.spec\.js/ : /__remote_api_disabled__/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  webServer: {
    command: webCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000, // 3 minutes for server startup
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      VITE_DATA_PROVIDER: dataProvider,
      VITE_MEDIA_PROVIDER: mediaProvider,
      VITE_API_BASE_URL: apiBaseURL,
      VITE_E2E_TEST: 'true',
    },
  },
});
