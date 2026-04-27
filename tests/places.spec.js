// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Yoav's Map (P3-1) — verifies the Leaflet map mounts, the section
 * is reachable from the nav, and the admin "Add place" UI is hidden
 * from anonymous visitors.
 *
 * No mutation tests against Firestore — admin pin creation requires
 * real auth and would create real /places docs. Mutation coverage
 * lands when the staging-env tier is in place (Phase 5).
 */

test.describe('Yoav\'s Map', () => {
  test('places section is present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#places')).toBeAttached();
    await expect(page.locator('#places .section-title')).toContainText('מקומות');
  });

  test('navigation has a Places link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav a[href="#places"]').first()).toBeVisible();
  });

  test('Leaflet map mounts and adds tiles', async ({ page }) => {
    await page.goto('/');
    // Leaflet adds the .leaflet-container class to the host element
    // once it initialises and a .leaflet-tile-pane for the OSM tiles.
    const map = page.locator('#placesMap.leaflet-container');
    await expect(map).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#placesMap .leaflet-tile-pane')).toBeAttached();
  });

  test('add-place controls are hidden from anonymous visitors', async ({ page }) => {
    await page.goto('/');
    const addBtn = page.locator('#addPlaceBtn');
    // .admin-only ancestors default to display:none for anonymous users.
    await expect(addBtn).toBeHidden();
    await expect(page.locator('#placesHint')).toBeHidden();
  });

  test('add-place modal markup exists in the DOM', async ({ page }) => {
    await page.goto('/');
    // Even though it's hidden by default, the form has to be present
    // so admin add-flow can openModal('placeModal') without injecting.
    const html = await page.content();
    expect(html).toContain('id="placeModal"');
    expect(html).toContain('id="placeName"');
    expect(html).toContain('id="placeStory"');
    expect(html).toContain('id="placeLat"');
    expect(html).toContain('id="placeLng"');
  });

  test('renderPlaces escapes hostile place data (XSS regression)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof renderPlaces === 'function' && typeof L !== 'undefined');

    // Inject a synthetic hostile pin and force a render. The popup
    // HTML must contain the literal payload as text, not an executing
    // script tag, and window.__pwned must not be set.
    const result = await page.evaluate(() => {
      placesData = [{
        id: 'x',
        name: '<img src=x onerror="window.__pwned=true">',
        story: '<script>window.__pwned=true</script>',
        lat: 32.0853, lng: 34.7818
      }];
      renderPlaces();
      // Open the popup so its HTML is rendered to the DOM
      const layers = placesLayer.getLayers();
      if (layers.length > 0) layers[0].openPopup();
      return {
        popupHtml: document.querySelector('.leaflet-popup-content')?.innerHTML || '',
        pwned:     window.__pwned === true
      };
    });

    expect(result.pwned).toBe(false);
    expect(result.popupHtml).toContain('&lt;img');
    expect(result.popupHtml).toContain('&lt;script');
  });
});
