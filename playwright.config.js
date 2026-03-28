// @ts-check
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000, // 60 seconds per test
  expect: {
    timeout: 10_000, // 10 seconds for expect assertions
  },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000, // 15 seconds for actions like click, fill, etc.
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000, // 3 minutes for server startup
    stdout: "ignore",
    stderr: "pipe",
    env: {
      VITE_DATA_PROVIDER: "local",
      VITE_MEDIA_PROVIDER: "local",
      VITE_API_BASE_URL: "http://localhost:4000",
      VITE_E2E_TEST: "true"
    }
  },
});
