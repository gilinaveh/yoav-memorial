// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Auth UI tests — exercise the LOGIN MODAL behaviour without performing
 * a successful login (we don't keep test admin credentials in the repo,
 * and we don't want to hit prod Firebase Auth in CI). Once a dev/staging
 * Firebase project exists (Phase 5 of the roadmap), we can extend these
 * to cover the full happy path.
 */

test.describe('Auth UI', () => {
  test('clicking the login button reveals email + password fields', async ({ page }) => {
    await page.goto('/');
    await page.locator('#loginBtn').click();
    await expect(page.locator('#loginModal')).toHaveClass(/open/);
    // Field labels reflect the post-migration state (email, not username).
    const emailLabel = await page.locator('#loginModal label:has(span[data-he]:has-text("אימייל"))').first();
    await expect(emailLabel).toBeVisible();
  });

  test('empty submit shows a "fill in fields" toast', async ({ page }) => {
    await page.goto('/');
    await page.locator('#loginBtn').click();
    // Click the submit button without filling anything.
    await page.locator('#loginModal button.btn-gold').click();
    // showToast() reveals #toast briefly.
    await expect(page.locator('#toast')).toBeVisible({ timeout: 3000 });
  });

  test('invalid credentials show an "invalid" toast', async ({ page }) => {
    test.setTimeout(15_000);
    await page.goto('/');
    await page.locator('#loginBtn').click();
    await page.locator('#loginUser').fill('nonexistent@example.com');
    await page.locator('#loginPass').fill('definitely-not-the-real-password');
    await page.locator('#loginModal button.btn-gold').click();
    // Firebase Auth call goes out to identitytoolkit.googleapis.com and
    // returns auth/invalid-credential. The site catches it and shows a toast.
    // We don't assert on the exact text because it can be Hebrew or English
    // depending on current language state.
    await expect(page.locator('#toast')).toBeVisible({ timeout: 8000 });
  });

  test('Escape closes the modal', async ({ page }) => {
    await page.goto('/');
    await page.locator('#loginBtn').click();
    await expect(page.locator('#loginModal')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#loginModal')).not.toHaveClass(/open/);
  });
});
