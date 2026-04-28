// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Time Capsule (P3-6) — letters sealed until a future reveal date.
 * No mutation tests against Firestore (would require admin auth and
 * would create real /letters docs); all checks here are about the
 * UI shell, the renderer's behavior with synthetic data, and the
 * defence-in-depth around hostile letter content.
 */

test.describe('Time Capsule', () => {
  test('letters section is present in the DOM', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#letters')).toBeAttached();
    await expect(page.locator('#letters .section-title')).toContainText('מכתבים');
  });

  test('navigation has a Letters link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav a[href="#letters"]').first()).toBeVisible();
  });

  test('write-letter modal markup exists', async ({ page }) => {
    await page.goto('/');
    const html = await page.content();
    expect(html).toContain('id="letterModal"');
    expect(html).toContain('id="letterAuthor"');
    expect(html).toContain('id="letterText"');
    expect(html).toContain('id="letterRevealDate"');
  });

  test('write-letter button is hidden from anonymous visitors', async ({ page }) => {
    await page.goto('/');
    // The button lives inside an .admin-only wrapper that's display:none
    // for non-admins. We locate the gold button inside #letters and
    // check it isn't visible.
    const writeBtn = page.locator('#letters .admin-only .btn-gold');
    await expect(writeBtn).toBeHidden();
  });

  test('renderLetters shows the empty state when no letters are unlocked', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof renderLetters === 'function');
    await page.evaluate(() => {
      lettersUnlockedData = [];
      lettersAllData      = [];
      renderLetters();
    });
    await expect(page.locator('#lettersEmpty')).toBeVisible();
  });

  test('renderLetters renders unlocked letters newest-first with escaped HTML', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof renderLetters === 'function');

    // Two synthetic unlocked letters with hostile content. The renderer
    // must escapeHtml() author + body so neither <img> nor <script>
    // executes, and must order by revealDate desc.
    const result = await page.evaluate(() => {
      const past1 = new Date('2024-01-01').getTime();
      const past2 = new Date('2025-01-01').getTime();
      lettersUnlockedData = [
        { id: 'a', author: 'Older',   text: 'Hello 2024',                            revealDate: new Date(past1) },
        { id: 'b', author: '<script>window.__pwned=true</script>', text: '<img src=x onerror="window.__pwned=true">', revealDate: new Date(past2) }
      ];
      lettersAllData = [];
      renderLetters();
      const cards = Array.from(document.querySelectorAll('#lettersContainer .letter-card'));
      return {
        count:  cards.length,
        firstAuthor: cards[0]?.querySelector('.letter-author')?.textContent || '',
        firstBodyHtml: cards[0]?.querySelector('.letter-body')?.innerHTML || '',
        pwned:  window.__pwned === true
      };
    });

    expect(result.count).toBe(2);
    expect(result.pwned).toBe(false);
    // Newest reveal first — 2025 letter ('b') should be first.
    expect(result.firstAuthor).toContain('script');     // text rendering of <script>...
    expect(result.firstBodyHtml).toContain('&lt;img'); // body escaped
  });

  test('renderLetters shows sealed counter for admin only', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof renderLetters === 'function');

    // Anonymous visitor: even if lettersAllData has entries, the
    // counter must stay hidden because currentUser is null.
    await page.evaluate(() => {
      lettersUnlockedData = [];
      lettersAllData      = [
        { id: 's1', author: 'A', text: 't', revealDate: new Date(Date.now() + 86400000) }
      ];
      renderLetters();
    });
    await expect(page.locator('#lettersSealed')).toBeHidden();

    // Simulate admin (without actually authenticating to prod).
    await page.evaluate(() => {
      currentUser = { uid: 'fake', email: 'a@b', role: 'admin', name: 'Admin' };
      renderLetters();
    });
    await expect(page.locator('#lettersSealed')).toBeVisible();
    await expect(page.locator('#lettersSealedCount')).toHaveText('1');
  });
});
