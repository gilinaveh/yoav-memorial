// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Yahrzeit feature (P3-4) — verifies the Hebrew calendar countdown,
 * the .ics export, and the footer Hebrew date. All checks are
 * deterministic relative to the current date because they reach into
 * Intl.DateTimeFormat directly rather than asserting on hardcoded
 * dates that would drift over time.
 */

test.describe('Yahrzeit', () => {
  test('section is present in the DOM', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#yahrzeit')).toBeVisible();
    await expect(page.locator('#yahrzeit .section-title')).toContainText('יום הזיכרון');
  });

  test('today\'s Hebrew date is rendered in both languages', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const he = document.getElementById('yahrzeitTodayHe');
      const en = document.getElementById('yahrzeitTodayEn');
      return he && he.textContent.trim().length > 0
          && en && en.textContent.trim().length > 0;
    });
    const he = await page.locator('#yahrzeitTodayHe').textContent();
    const en = await page.locator('#yahrzeitTodayEn').textContent();
    // Hebrew should contain Hebrew letters (Unicode range \u0590–\u05FF)
    expect(he).toMatch(/[\u0590-\u05FF]/);
    // English should be a Roman-letter month name + numerics
    expect(en).toMatch(/[A-Za-z]/);
    expect(en).toMatch(/\d/);
  });

  test('countdown shows a non-negative number of days OR yahrzeit banner', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const c = document.getElementById('yahrzeitContent');
      return c && c.children.length > 0;
    });
    const isYahrzeit = await page.evaluate(() => isYahrzeitToday());
    if (isYahrzeit) {
      // On the day itself we show a banner instead of a countdown.
      await expect(page.locator('.yahrzeit-day-banner')).toBeVisible();
    } else {
      const countdown = page.locator('.yc-countdown strong').first();
      await expect(countdown).toBeVisible();
      const days = Number(await countdown.textContent());
      expect(days).toBeGreaterThanOrEqual(0);
      expect(days).toBeLessThanOrEqual(385); // a Hebrew leap year is at most 385 days
      // And the Add-to-Calendar button is wired up.
      await expect(page.locator('.yahrzeit-card .btn-gold')).toBeVisible();
    }
  });

  test('nextYahrzeit() returns a future date with day 11 in Tishri', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof nextYahrzeit === 'function');
    const result = await page.evaluate(() => {
      const d = nextYahrzeit();
      if (!d) return null;
      const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', {
        day: 'numeric', month: 'long'
      }).formatToParts(d);
      return {
        iso: d.toISOString(),
        month: parts.find(p => p.type === 'month')?.value,
        day:   Number(parts.find(p => p.type === 'day')?.value),
        future: d.getTime() >= Date.now() - 86400000
      };
    });
    expect(result).not.toBeNull();
    expect(result.month).toBe('Tishri');
    expect(result.day).toBe(11);
    expect(result.future).toBe(true);
  });

  test('googleCalendarUrl produces a valid prefill URL', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof googleCalendarUrl === 'function');
    const url = await page.evaluate(() => {
      const next = nextYahrzeit() || new Date();
      return googleCalendarUrl(next);
    });
    // Must point at calendar.google.com's render endpoint with the
    // template action so visitors land on a pre-filled "save" view.
    expect(url).toContain('https://calendar.google.com/calendar/render');
    expect(url).toContain('action=TEMPLATE');
    // Title and dates and description fields must all be present
    expect(url).toMatch(/text=[^&]+yahrzeit/i);
    expect(url).toMatch(/dates=\d{8}%2F\d{8}|dates=\d{8}\/\d{8}/);
    expect(url).toContain('details=');
  });

  test('Add-to-Google-Calendar button is present and renders before the .ics fallback', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const c = document.getElementById('yahrzeitContent');
      return c && c.children.length > 0;
    });
    // Skip when it's the actual yahrzeit day (the buttons are hidden in
    // favour of the memorial banner).
    const isYahrzeit = await page.evaluate(() => isYahrzeitToday());
    test.skip(isYahrzeit, 'On the yahrzeit day itself the buttons are replaced by the memorial banner');

    const buttons = page.locator('.yahrzeit-cal-buttons .btn');
    await expect(buttons).toHaveCount(2);
    // First button is the Google Calendar primary
    await expect(buttons.first()).toHaveClass(/btn-gold/);
    // Second is the .ics download
    await expect(buttons.nth(1)).toHaveClass(/btn-outline/);
  });

  test('buildYahrzeitICS produces a valid RFC 5545 calendar', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof buildYahrzeitICS === 'function');
    const ics = await page.evaluate(() => {
      const next = nextYahrzeit() || new Date();
      return buildYahrzeitICS(next);
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('SUMMARY:');
    expect(ics).toContain('TRIGGER:-P7D');   // 7-day reminder
    // No raw newlines — RFC 5545 requires CRLF.
    expect(ics.includes('\r\n')).toBe(true);
  });

  test('footer shows today\'s Hebrew date', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const el = document.getElementById('footerHebrewDate');
      return el && el.textContent.trim().length > 0;
    });
    const text = await page.locator('#footerHebrewDate').textContent();
    expect(text).toMatch(/[\u0590-\u05FF]/);
  });
});
