import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke-test config for the Conduit acceptance markers ("Conduit", "Global Feed",
 * "How to train your dragon", "Popular Tags" — see ../.colossus-acceptance.json).
 *
 * Set PLAYWRIGHT_BASE_URL to point at an already-running instance (a docker-compose
 * stack, staging, or production). When it is unset, Playwright starts the Angular dev
 * server itself via `npm start` (which proxies /api to localhost:3001 per
 * proxy.conf.json) — the backend API and a seeded Postgres must already be reachable
 * at that address for the article/tag assertions to pass, since this test asserts the
 * *hydrated* DOM (real API data), not the static pre-boot markup in index.html.
 */
const baseURL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env['PLAYWRIGHT_BASE_URL']
    ? undefined
    : {
        command: 'npm start',
        url: baseURL,
        reuseExistingServer: !process.env['CI'],
        timeout: 120_000,
      },
});
