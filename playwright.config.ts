import { defineConfig, devices } from '@playwright/test';

// E2E runs against the dev server + real backend (started below).
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 1,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node server/index.js',
      url: 'http://127.0.0.1:3947/api/health',
      reuseExistingServer: true,
      env: {
        BACKEND_PORT: '3947',
        // Test-only: the e2e matrix creates far more letters than a human;
        // production keeps the strict defaults.
        RATE_LIMIT_CREATE_MAX: '1000',
        RATE_LIMIT_UNLOCK_MAX: '1000',
      },
    },
    {
      command: 'npm run dev -- --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
  ],
});
