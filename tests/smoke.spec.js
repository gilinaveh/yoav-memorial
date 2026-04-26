// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Smoke tests — these prove the page loads and the basic shell renders.
 * No writes to Firestore, no admin login. Safe to run against any environment.
 */

test.describe('Smoke', () => {
  test('homepage loads with hero name in Hebrew and English', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-name')).toContainText('יואב אגמון');
    await expect(page.locator('.hero-name-en')).toContainText('Yoav Agmon');
  });

  test('all navigation links are present', async ({ page }) => {
    await page.goto('/');
    const expected = [
      'אודות',         // About
      'תמונות',         // Photos
      'ציר זמן',         // Timeline
      'סיפורים',         // Stories
      'נרות זיכרון',     // Memorial candles
      'תגובות',         // Comments
    ];
    for (const text of expected) {
      await expect(page.locator(`nav >> text=${text}`)).toBeVisible();
    }
  });

  test('login button opens the admin login modal', async ({ page }) => {
    await page.goto('/');
    await page.locator('#loginBtn').click();
    await expect(page.locator('#loginModal')).toHaveClass(/open/);
    await expect(page.locator('#loginUser')).toBeVisible();
    await expect(page.locator('#loginPass')).toBeVisible();
  });

  test('language toggle flips html dir + lang attributes', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await page.locator('#langBtn').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('Firebase + site config loaded into window', async ({ page }) => {
    await page.goto('/');
    // Site config must be present for the rest of the app to work.
    const cfg = await page.evaluate(() => ({
      hasSiteConfig: typeof window.SITE_CONFIG === 'object' && window.SITE_CONFIG !== null,
      projectId:     window.SITE_CONFIG?.firebase?.projectId,
      hasDriveCfg:   !!window.SITE_CONFIG?.drive?.folderId,
    }));
    expect(cfg.hasSiteConfig).toBe(true);
    expect(cfg.projectId).toBe('yoav-memorial-7a8a3');
    expect(cfg.hasDriveCfg).toBe(true);
  });

  test('favicon link is present and points to favicon.svg', async ({ page }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="icon"]').first().getAttribute('href');
    expect(href).toBe('favicon.svg');
  });
});
