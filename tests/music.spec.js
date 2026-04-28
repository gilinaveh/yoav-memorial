// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Music for Yoav — songs he loved + songs about him. The renderer
 * lazy-mounts iframes via IntersectionObserver, so most assertions
 * here use synthetic data and inspect either the placeholder state
 * (off-screen) or the mounted iframe state (on-screen).
 *
 * No mutation tests against Firestore: admin writes require real auth
 * and would create real /songs docs. URL-parser correctness, XSS
 * defence, and lazy-mount behaviour are all verifiable against the
 * inline globals.
 */

test.describe('Music for Yoav', () => {
  test('music section is present in the DOM', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#music')).toBeAttached();
    await expect(page.locator('#music .section-title')).toContainText('מוזיקה');
  });

  test('navigation has a Music link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav a[href="#music"]').first()).toBeVisible();
  });

  test('two tabs are present, "loved" is active by default', async ({ page }) => {
    await page.goto('/');
    // First-time visitor — no localStorage entry, so default is 'loved'.
    await page.evaluate(() => {
      try { localStorage.removeItem('yoav-music-tab'); } catch (_) {}
    });
    await page.reload();
    await expect(page.locator('#musicTabLoved')).toHaveClass(/active/);
    await expect(page.locator('#musicTabAbout')).not.toHaveClass(/active/);
    await expect(page.locator('#musicTabLoved')).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking a tab switches active state and persists in localStorage', async ({ page }) => {
    await page.goto('/');
    await page.click('#musicTabAbout');
    await expect(page.locator('#musicTabAbout')).toHaveClass(/active/);
    await expect(page.locator('#musicTabLoved')).not.toHaveClass(/active/);
    const stored = await page.evaluate(() => localStorage.getItem('yoav-music-tab'));
    expect(stored).toBe('about');
  });

  test('add-song button is hidden from anonymous visitors', async ({ page }) => {
    await page.goto('/');
    // The button lives inside an .admin-only wrapper that's display:none
    // for non-admins. Locate the gold button inside #music and confirm
    // it isn't visible to a logged-out visitor.
    const addBtn = page.locator('#music .admin-only .btn-gold');
    await expect(addBtn).toBeHidden();
  });

  test('add-song modal markup exists', async ({ page }) => {
    await page.goto('/');
    const html = await page.content();
    expect(html).toContain('id="songModal"');
    expect(html).toContain('id="songUrl"');
    expect(html).toContain('id="songTitle"');
    expect(html).toContain('id="songArtist"');
    expect(html).toContain('id="songNote"');
    expect(html).toContain('name="songType"');
  });

  test('renderSongs shows the empty state when no songs match the active tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof renderSongs === 'function');
    await page.evaluate(() => {
      songsData = [];
      activeMusicTab = 'loved';
      renderSongs();
    });
    await expect(page.locator('#musicEmpty')).toBeVisible();
    await expect(page.locator('#musicGrid')).toBeHidden();
  });

  test('renderSongs lays out cards for the active tab and escapes hostile data', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof renderSongs === 'function');

    const result = await page.evaluate(() => {
      songsData = [
        {
          id: 'a',
          title:  '<img src=x onerror="window.__pwned=true">',
          artist: '<script>window.__pwned=true</script>',
          note:   '<svg onload="window.__pwned=true">',
          type: 'loved',
          platform: 'youtube',
          embedId: 'dQw4w9WgXcQ'
        },
        {
          id: 'b',
          title: 'Other song',
          artist: 'Other artist',
          type: 'about',           // belongs to the OTHER tab
          platform: 'spotify',
          embedId: '6rqhFgbbKwnb9MLmUQDhG6'
        }
      ];
      activeMusicTab = 'loved';
      renderSongs();
      const cards = Array.from(document.querySelectorAll('#musicGrid .song-card'));
      return {
        count: cards.length,
        firstCardHtml: cards[0]?.innerHTML || '',
        pwned: window.__pwned === true
      };
    });

    // Only the 'loved' card should render.
    expect(result.count).toBe(1);
    expect(result.pwned).toBe(false);
    // Hostile content must be escaped — entities present, raw <script> absent.
    expect(result.firstCardHtml).toContain('&lt;img');
    expect(result.firstCardHtml).toContain('&lt;script');
    expect(result.firstCardHtml).toContain('&lt;svg');
    expect(result.firstCardHtml).not.toMatch(/<script\b[^>]*>/i);
  });

  test('iframes are NOT mounted until cards intersect the viewport', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof renderSongs === 'function');

    // Inject a card and verify that, immediately after render, the
    // .song-embed wrapper still holds the placeholder rather than an
    // iframe. The IntersectionObserver fires asynchronously; for a
    // fresh DOM with the card potentially below the fold, the iframe
    // should not have replaced the placeholder synchronously.
    const result = await page.evaluate(() => {
      // Force the section out of the viewport by scrolling to the very
      // top first so the fresh card lands somewhere mid/lower-page.
      window.scrollTo(0, 0);
      songsData = [{
        id: 'lazy',
        title: 'Lazy track',
        artist: 'Lazy band',
        type: 'loved',
        platform: 'youtube',
        embedId: 'dQw4w9WgXcQ'
      }];
      activeMusicTab = 'loved';
      renderSongs();
      const wrap = document.querySelector('#musicGrid .song-embed');
      return {
        hasPlaceholder: !!wrap?.querySelector('.song-embed-placeholder'),
        // dataset.mounted is '0' until the observer flips it.
        // (May briefly be '1' if the card happens to already be in
        // the viewport, so we don't assert the negative — we just
        // confirm the data attribute exists.)
        hasDataset: wrap?.getAttribute('data-mounted') !== null,
        platform: wrap?.getAttribute('data-platform'),
        embedId:  wrap?.getAttribute('data-embed-id')
      };
    });
    expect(result.hasDataset).toBe(true);
    expect(result.platform).toBe('youtube');
    expect(result.embedId).toBe('dQw4w9WgXcQ');
    // Placeholder is present at the moment of render — even if the
    // observer fires immediately afterwards, it would have just been
    // visible in the snapshot above.
    expect(result.hasPlaceholder).toBe(true);
  });

  test('iframe mounts when scrolled into view, with strict-origin referrer', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof renderSongs === 'function');

    // Render a card and scroll it into view. The observer should
    // mount the iframe within a frame or two.
    await page.evaluate(() => {
      songsData = [{
        id: 'visible',
        title: 'Visible track',
        artist: 'Visible band',
        type: 'loved',
        platform: 'youtube',
        embedId: 'dQw4w9WgXcQ'
      }];
      activeMusicTab = 'loved';
      renderSongs();
      document.querySelector('#music')?.scrollIntoView({ block: 'center' });
    });

    const iframe = page.locator('#musicGrid .song-embed iframe');
    await expect(iframe).toBeAttached({ timeout: 4000 });
    await expect(iframe).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    await expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  });

  test('parseSongUrl recognises common share URL shapes', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof parseSongUrl === 'function');

    const cases = await page.evaluate(() => {
      return [
        parseSongUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
        parseSongUrl('https://youtu.be/dQw4w9WgXcQ'),
        parseSongUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s'),
        parseSongUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ'),
        parseSongUrl('https://www.youtube.com/embed/dQw4w9WgXcQ'),
        parseSongUrl('https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6?si=abc'),
        parseSongUrl('https://open.spotify.com/intl-he/track/6rqhFgbbKwnb9MLmUQDhG6'),
        parseSongUrl('   '),
        parseSongUrl('https://example.com/not-a-song'),
        parseSongUrl(null)
      ];
    });

    expect(cases[0]).toEqual({ platform: 'youtube', embedId: 'dQw4w9WgXcQ' });
    expect(cases[1]).toEqual({ platform: 'youtube', embedId: 'dQw4w9WgXcQ' });
    expect(cases[2]).toEqual({ platform: 'youtube', embedId: 'dQw4w9WgXcQ' });
    expect(cases[3]).toEqual({ platform: 'youtube', embedId: 'dQw4w9WgXcQ' });
    expect(cases[4]).toEqual({ platform: 'youtube', embedId: 'dQw4w9WgXcQ' });
    expect(cases[5]).toEqual({ platform: 'spotify', embedId: '6rqhFgbbKwnb9MLmUQDhG6' });
    expect(cases[6]).toEqual({ platform: 'spotify', embedId: '6rqhFgbbKwnb9MLmUQDhG6' });
    expect(cases[7]).toBeNull();
    expect(cases[8]).toBeNull();
    expect(cases[9]).toBeNull();
  });

  test('songEmbedSrc builds the expected iframe URLs', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof songEmbedSrc === 'function');

    const result = await page.evaluate(() => ({
      youtube: songEmbedSrc('youtube', 'dQw4w9WgXcQ'),
      spotify: songEmbedSrc('spotify', '6rqhFgbbKwnb9MLmUQDhG6'),
      bogus  : songEmbedSrc('bogus',   'whatever')
    }));

    expect(result.youtube).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(result.youtube).toContain('rel=0');
    expect(result.spotify).toContain('https://open.spotify.com/embed/track/6rqhFgbbKwnb9MLmUQDhG6');
    expect(result.bogus).toBe('');
  });
});
