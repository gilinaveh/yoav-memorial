// @ts-check
import { test, expect } from '@playwright/test';

/**
 * XSS protection — verifies that escapeHtml() correctly neutralises hostile
 * input before it reaches innerHTML. This is the function that closes
 * P0-3 from the security audit; if it ever regresses, every comment box
 * on the live site becomes a vector for arbitrary script execution.
 */

test.describe('XSS protection', () => {
  test('escapeHtml is defined and accessible at runtime', async ({ page }) => {
    await page.goto('/');
    // Wait for the inline script that defines escapeHtml to run.
    await page.waitForFunction(() => typeof escapeHtml === 'function', null, { timeout: 5000 });
  });

  test('escapeHtml neutralises common XSS payloads', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof escapeHtml === 'function');

    const result = await page.evaluate(() => ({
      script:   escapeHtml('<script>alert(1)</script>'),
      img:      escapeHtml('<img src=x onerror=alert(1)>'),
      svg:      escapeHtml('"><svg onload=alert(1)>'),
      iframe:   escapeHtml('<iframe src="javascript:alert(1)"></iframe>'),
      ampersand: escapeHtml('Tom & Jerry'),
      quote:    escapeHtml(`"hello"`),
      apos:     escapeHtml(`it's`),
      empty:    escapeHtml(''),
      nullish:  escapeHtml(null),
      number:   escapeHtml(42),
    }));

    expect(result.script).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(result.img).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(result.svg).toContain('&quot;');
    expect(result.svg).toContain('&lt;');
    expect(result.iframe).toContain('&lt;iframe');
    // Non-malicious cases still escape the special chars but don't break content
    expect(result.ampersand).toBe('Tom &amp; Jerry');
    expect(result.quote).toBe('&quot;hello&quot;');
    expect(result.apos).toBe('it&#39;s');
    // Edge cases
    expect(result.empty).toBe('');
    expect(result.nullish).toBe('');
    expect(result.number).toBe('42');
  });

  test('hostile payload posted into a candle name renders as text, not HTML', async ({ page }) => {
    // We don't actually POST to Firestore in this test (no mutation against prod).
    // Instead, simulate what the renderer does by injecting an entry into the
    // local candlesData array and forcing a re-render.
    await page.goto('/');
    await page.waitForFunction(() => typeof renderCandles === 'function');

    // Inject a candle whose name contains an XSS payload, then re-render.
    const evilName = '<img src=x onerror="window.__pwned=true">';
    await page.evaluate((name) => {
      // candlesData is a top-level let in the inline script.
      // Push a synthetic entry and re-render.
      candlesData = [{ id: 'test-evil', name, createdAt: Date.now() }];
      renderCandles();
    }, evilName);

    // Confirm the payload did not execute.
    const pwned = await page.evaluate(() => window.__pwned === true);
    expect(pwned).toBe(false);

    // Confirm the literal string is visible in the DOM (escaped).
    const textContent = await page.locator('.candles-row .candle .candle-name').first().textContent();
    expect(textContent).toContain('<img');
    expect(textContent).toContain('onerror');
  });
});
