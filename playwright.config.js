// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the Yoav Agmon memorial site.
 *
 * Tests run against a local static server (npx serve) so they don't
 * touch the production Firestore. Mutation tests (creating real
 * candles / comments) are deliberately NOT included here yet — they'll
 * land when we add a dev/staging Firebase project (Phase 5 of the
 * roadmap). Until then, tests cover only:
 *   • smoke   — page loads, hero renders, navigation works
 *   • xss     — escapeHtml() correctly escapes hostile input
 *   • auth-ui — login modal opens, validates fields, error toasts work
 *
 * Run locally:   npm test
 * Run with UI:   npm run test:ui   (opens Playwright's interactive runner)
 * Headed mode:   npm run test:headed   (watch the tests run in a real browser)
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Add { name: 'firefox', ... } / { name: 'webkit', ... } once
    // the Chromium suite is solid.
  ],

  webServer: {
    command: 'npx serve -l 8080 .',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
});
