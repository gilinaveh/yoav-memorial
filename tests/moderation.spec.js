// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Moderation flow (P0-7) — verifies the comment-form UX changes that
 * came with the moderation queue. Doesn't actually mutate Firestore
 * (we don't want CI creating real `pending` docs); just confirms the
 * UI surfaces the correct messaging and the admin-only section is
 * properly hidden from logged-out visitors.
 */

test.describe('Moderation queue', () => {
  test('comment form shows the "awaiting approval" notice', async ({ page }) => {
    await page.goto('/');
    // The static notice under the submit button — visible to every
    // visitor so they know their post won't appear immediately.
    const notice = page.locator(
      '#comments .comment-form p:has(span[data-he]:has-text("עובר אישור"))'
    );
    await expect(notice).toBeVisible();
  });

  test('moderation section is NOT visible to anonymous visitors', async ({ page }) => {
    await page.goto('/');
    // .admin-only elements default to display:none; only flipped to
    // visible after a successful admin login.
    const modSection = page.locator('#moderationSection');
    await expect(modSection).toBeHidden();
  });

  test('moderation section markup exists in the DOM', async ({ page }) => {
    await page.goto('/');
    // Even though it's hidden, the section + its containers must exist
    // so subscribeModeration() has somewhere to render into when admin
    // logs in.
    const html = await page.content();
    expect(html).toContain('id="pendingCommentsContainer"');
    expect(html).toContain('id="pendingStoriesContainer"');
    expect(html).toContain('id="moderationSection"');
  });

  test('submitting a comment shows an "awaiting approval" toast', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.fbDB?.addComment === 'function');

    // Stub fbDB.addComment so we don't actually write to prod Firestore,
    // and so we can drive the form without dragging in network latency.
    await page.evaluate(() => {
      window.fbDB.addComment = () => Promise.resolve({ id: 'fake' });
    });

    await page.fill('#commentName', 'TestVisitor');
    await page.fill('#commentText', 'Hello world');
    // Click the dedicated "Send Message" button inside the form. The
    // navigation has its own כניסה button, so we scope the locator.
    await page.locator('#comments .comment-form button.btn-gold').click();

    // The new toast text mentions awaiting approval — confirms the
    // moderation flow change reached the user-visible string.
    const toast = page.locator('#toast');
    await expect(toast).toBeVisible({ timeout: 3000 });
    const text = await toast.textContent();
    expect(text).toMatch(/awaiting approval|ממתין לאישור/i);
  });
});
