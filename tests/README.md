# Tests

Automated tests for the Yoav Agmon memorial site, using
[Playwright](https://playwright.dev/).

## What's covered

| Spec               | What it proves                                                       |
| ------------------ | -------------------------------------------------------------------- |
| `smoke.spec.js`    | Page loads, hero renders, navigation links exist, language toggle works, site config is loaded, favicon is present. |
| `xss.spec.js`      | `escapeHtml()` correctly neutralises script/img/svg/iframe payloads. A simulated hostile candle entry renders as text and does NOT execute. |
| `auth-ui.spec.js`  | Login modal opens, validates empty fields, shows error toast on bad credentials, closes on Escape. Doesn't actually sign in (no test creds in repo). |

## What's deliberately not covered yet

These need either test credentials or a separate Firestore test
project, and will land when the dev/staging tier from the roadmap is
in place:

- Successful admin login (welcome toast + admin bar appears)
- Lighting a real candle (creates a doc in Firestore)
- Posting a real comment / story
- Admin deleting a comment / story
- Drive upload flow

Tracking those mutation tests against production would create real
candles with names like `test-1747234567` showing up on the live site.
Not great.

## Running locally

You need Node 20+ on your machine.

```bash
# one-time install
npm install
npx playwright install --with-deps chromium

# run all tests headlessly
npm test

# open Playwright's interactive UI (best for debugging)
npm run test:ui

# watch tests run in a real browser window
npm run test:headed
```

The first run will open a local static server on port 8080 (via
`npx serve`) and run Chromium against `http://localhost:8080`.

If port 8080 is busy, edit `playwright.config.js` and change the port
in both `webServer.command` and `use.baseURL`.

## Running in CI

`.github/workflows/test.yml` runs the full suite on every PR and on
every push to `main`. If a test fails, the Playwright HTML report is
uploaded as an artifact named `playwright-report` — download it from
the failed Actions run, unzip, open `index.html` in a browser, and
you'll see screenshots / videos / step-by-step traces of what broke.

## Adding a new test

```js
// tests/my-feature.spec.js
import { test, expect } from '@playwright/test';

test.describe('My feature', () => {
  test('does the thing', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

Then `npm test` and the new file is picked up automatically.

## Tips

- Selectors prefer `text=` over CSS where readable: `nav >> text=כניסה`.
- Use `page.evaluate(() => …)` to poke at the inline script's globals
  (`escapeHtml`, `renderCandles`, `candlesData`, etc.) — see
  `xss.spec.js` for an example.
- Avoid `waitForTimeout` — use `expect(...).toBeVisible({ timeout: ... })`
  or `page.waitForFunction(...)` instead.
