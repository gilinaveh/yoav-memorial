# Session Handoff — Yoav Agmon Memorial

> **Purpose of this document.** A long-running pairing project with Claude where
> the conversation gets summarized/compacted periodically. This file is the
> source of truth that survives compaction. Update it at the end of every
> session that ships meaningful work.
>
> **Last updated:** April 27, 2026 (post-music)
> **Test count:** 50 Playwright specs, all green (38 prior + 12 new music specs)
> **Live site:** https://gilinaveh.github.io/yoav-memorial/
> **Repo:** https://github.com/gilinaveh/yoav-memorial

---

## What this project is

A bilingual (Hebrew RTL + English LTR) memorial site for Yoav Agmon — לוחם
גולני, חובש, בן, אח, חבר לכולם. Static site hosted on GitHub Pages,
auto-deploys on every push to `main`. Backend is Firebase (Firestore +
Auth). Single-file front-end (`index.html`) — no build step, no bundler.

The site has a hard real-world deadline: Gil meets Yoav's parents soon, and
each shipped feature is something tangible to show them.

---

## Current state — feature inventory

### Phase 1 (Security & Hardening) — 100% done
- **P0-1** Hardcoded passwords removed → Firebase Auth + `/admins/{uid}` doc
  membership controls admin access.
- **P0-2** Firestore Security Rules deployed (see `firestore.rules`).
- **P0-3** XSS escaped on every renderer via `escapeHtml()`.
- **P0-4** App Check wired but gated off (toggle in `config/site-config.js`
  → `appCheck.enabled`). Turn on once we have a reCAPTCHA v3 site key.
- **P0-5** Content Security Policy via `<meta>` tag in index.html.
- **P0-6** Firebase config moved to `config/site-config.js` (still public
  by Firebase design — rules are the actual perimeter).
- **P0-7** Comment & story moderation queue. New posts arrive
  `status: 'pending'`; admins approve/reject from the moderation panel.
  Pre-existing docs were backfilled to `approved` by
  `scripts/migrate-add-status.js`.
- **P0-8** Drive sharing audit — folder stays "Anyone with link" because
  the file-listing API needs the folder readable; per-file sharing only
  helps thumbnails.
- **P1-2** Branch protection on `main` + required Tests check.
- **P1-4** Playwright suite + GitHub Actions CI (`.github/workflows/test.yml`).
- **P1-6** Lazy-load gallery (skeleton shimmer + fade-in,
  `loading="lazy"` on `<img>`).
- **P1-7** A11y + SEO: OG/Twitter cards, ARIA labels, alt text,
  focus-visible rings, `prefers-reduced-motion` support.
- **P1-8** Daily automated Firestore backup
  (`.github/workflows/backup.yml`, cron 22:00 UTC, 90-day artifact retention).

### Phase 3 (Memorial features) — 4 done
- **P3-1 Yoav's Map** — Leaflet + OpenStreetMap. Admin-only
  click-to-place pin flow. Firestore `/places` with bounded lat/lng rules.
  XSS-tested popup HTML.
- **P3-4 Hebrew Yahrzeit** — Intl-based Hebrew calendar countdown to
  11 Tishri, .ics download (RFC 5545, 7-day reminder), Google Calendar
  prefill button, footer Hebrew date that updates daily.
- **P3-6 Time Capsule (Letters)** — Sealed letters with future
  `revealDate`. Public listener queries `where revealDate <= now`;
  Firestore rule mirrors that on the server so even a hostile client
  can't read sealed letters. Admins see all letters + a sealed counter.
- **P3-7 Music for Yoav** — Songs Yoav loved + songs about him,
  embedded YouTube/Spotify players. Two tabs (loved/about) with the
  active tab persisted to localStorage. Admin-only writes via a modal
  that auto-parses YouTube and Spotify share URLs into platform +
  embedId. Iframes lazy-mount via IntersectionObserver (200px
  rootMargin) so initial page load doesn't pay the embed cost.
  Firestore `/songs` collection, rules constrain `type ∈ {loved, about}`
  and `platform ∈ {youtube, spotify}`. CSP `frame-src` extended to
  `youtube.com`, `youtube-nocookie.com`, `open.spotify.com`; `img-src`
  extended to `i.ytimg.com` and `i.scdn.co`. 12 Playwright specs cover
  section presence, nav link, tab switching + persistence, admin-only
  add button, modal markup, empty-state, hostile-data escaping,
  lazy-mount behaviour, mounted iframe URL shape, parseSongUrl URL
  shape recognition, and songEmbedSrc URL composition.

### In flight
*(none — music shipped)*

### Still on the roadmap (not started)
- **P1-1** Vite + modular refactor (split index.html into modules).
- **P1-3** Netlify or Vercel migration (better headers, faster CDN).
- **P1-5** Image CDN (Cloudinary or imgix) to replace Drive thumbnails.
- **Phase 5** Three-tier dev environment — separate Firebase projects
  for dev / staging / prod. Unlocks mutation tests in CI.
- Other Phase 3 ideas: memory-tree visualization, video tributes,
  unit-mate testimonial collector.

---

## Architecture cheat sheet

### Front-end
- Single `index.html` (~2700 lines after all features). All JS, CSS,
  HTML in one file. Bilingual via `data-he` / `data-en` attributes
  toggled by a language switcher.
- Firebase modular SDK loaded via `<script type="module">`. Bridge
  exposes `window.fbDB` with all CRUD ops so the inline non-module
  script can call them.
- Helpers: `escapeHtml()`, `todayHebrewDate()`, `nextYahrzeit()`,
  `daysUntil()`, `isYahrzeitToday()`, `buildYahrzeitICS()`,
  `googleCalendarUrl()`, `initPlacesMap()`, `renderPlaces()`,
  `renderLetters()`, `renderModerationQueue()`.

### Back-end (Firebase)
- Project ID: `yoav-memorial-7a8a3`.
- Collections: `candles`, `comments`, `stories`, `places`, `letters`,
  `songs`, `admins` (UID-keyed membership).
- Auth: anonymous for visitor writes, email+password for admins.
- Rules: `firestore.rules`. Admins identified by existence of
  `/admins/{uid}`.
- Indexes: composite `status + createdAt` on `comments` and `stories`
  (auto-created via Firestore console links when first triggered).

### Deployment paths (CRITICAL — these deploy independently)
1. **Code** — `git push origin main` → GitHub Pages auto-deploy
   (1-2 min). The `feature/*` branch convention lives. Review +
   merge via PR; required Tests check must be green.
2. **Firestore Rules** — *do NOT auto-deploy with code.* They must be
   manually pasted into Firebase Console → Firestore → Rules → Publish.
   This separation is intentional (security-sensitive, want a human
   to confirm). Pull the latest from
   `https://raw.githubusercontent.com/gilinaveh/yoav-memorial/main/firestore.rules`.
3. **Firestore Indexes** — when a new query needs one, the console
   shows an auto-create link in the error log; click it.
4. **GitHub Secrets** — `FIREBASE_SERVICE_ACCOUNT` (for backup
   workflow) is the full JSON key as one secret value.

### File structure
```
/
├── index.html                        # the site
├── firestore.rules                   # security rules (deploy via console)
├── firestore.indexes.json            # composite index definitions
├── firebase.json                     # firebase CLI config
├── favicon.svg                       # gold star on dark blue
├── package.json                      # ES module, scripts: test, test:ui, test:headed
├── playwright.config.js              # localhost:8080, Chromium only
├── README.md                         # project overview + badges
├── SECURITY-MIGRATION.md             # deploy/admin/backup procedures
├── HANDOFF.md                        # this file — session continuity
├── config/
│   └── site-config.js                # window.SITE_CONFIG: firebase, drive, appCheck
├── docs/
│   ├── memorial-roadmap.html         # full audit + roadmap
│   └── testing-checklist.html        # post-deploy manual + auto checklist
├── scripts/
│   ├── backup-firestore.js           # used by backup workflow
│   ├── restore-firestore.js          # local-only, opt-in
│   └── migrate-add-status.js         # one-shot, used during P0-7 deploy
├── tests/
│   ├── README.md
│   ├── smoke.spec.js                 # 4 specs: page loads, lang toggle, nav, config
│   ├── xss.spec.js                   # escapeHtml + render-time integration
│   ├── auth-ui.spec.js               # login modal behaviour
│   ├── moderation.spec.js            # P0-7 moderation queue
│   ├── yahrzeit.spec.js              # P3-4 Hebrew calendar
│   ├── places.spec.js                # P3-1 Leaflet map + XSS
│   ├── letters.spec.js               # P3-6 Time Capsule
│   └── music.spec.js                 # P3-7 Music for Yoav
└── .github/workflows/
    ├── test.yml                      # Playwright CI on push + PR
    └── backup.yml                    # daily Firestore backup, cron 22:00 UTC
```

---

## Recent shipping log

| Date         | Branch / PR             | What shipped                                    |
| ------------ | ----------------------- | ----------------------------------------------- |
| Apr 25, 2026 | `feature/firebase-auth` | P0-1 hardcoded passwords removed, Auth wired   |
| Apr 25, 2026 | `feature/firestore-rules` | P0-2 rules deployed                          |
| Apr 25, 2026 | `feature/xss-fix`       | P0-3 escapeHtml on all renderers                |
| Apr 25, 2026 | `feature/csp-config`    | P0-4 App Check (gated), P0-5 CSP, P0-6 config  |
| Apr 25, 2026 | `feature/playwright`    | P1-4 13 specs + CI                             |
| Apr 25, 2026 | `feature/branch-protection` | P1-2 main protected                         |
| Apr 26, 2026 | `feature/lazy-gallery`  | P1-6 lazy-load gallery                          |
| Apr 26, 2026 | `feature/a11y-seo`      | P1-7 OG/Twitter, ARIA, alt, focus, reduced-motion |
| Apr 26, 2026 | `feature/backup`        | P1-8 daily backup workflow                      |
| Apr 26, 2026 | `feature/moderation`    | P0-7 comment/story moderation                   |
| Apr 26, 2026 | `feature/yahrzeit`      | P3-4 Hebrew calendar yahrzeit + .ics + GCal     |
| Apr 26, 2026 | `feature/yoavs-map`     | P3-1 Leaflet places                             |
| Apr 26, 2026 | `feature/time-capsule`  | P3-6 sealed letters                             |
| Apr 27, 2026 | (handoff session)       | Created HANDOFF.md + refreshed testing-checklist |
| Apr 27, 2026 | `feature/music`         | P3-7 music — YouTube/Spotify embeds, lazy mount, 12 new specs |

---

## Recurring gotchas (from prior sessions)

1. **Rules don't auto-deploy.** Every session, Gil has to be reminded
   that `git push` doesn't update Firestore rules. Mention it in any
   PR that touches `firestore.rules`.
2. **Service account JSON pasted partially** — when rotating
   `FIREBASE_SERVICE_ACCOUNT`, copy the *entire* file including the
   outer braces. A truncated paste kills the backup workflow silently.
3. **`/admins/{uid}` doc IDs must be the long alphanumeric UID**, not
   the email. Get UIDs from Firebase Auth → Users tab.
4. **Composite index errors** — first time a moderation query runs,
   Firestore throws `failed-precondition` with a one-click create
   link in the error message. Click it; wait 1-2 minutes for the index
   to build.
5. **Direct deep links to Firebase Console rules tab bounce to
   Overview** — navigate manually via the sidebar (Firestore Database
   → Rules tab) instead.
6. **CSP rejects Drive rate-limit redirects** to `www.google.com/sorry/`.
   `www.google.com` is already in `img-src`. Don't remove it.
7. **Anonymous Firebase Auth sign-in is required for visitor writes**
   under the new rules. The site auto-signs-in anonymously on load —
   if rules ever start rejecting visitor candles/comments, check that
   anon auth is still enabled in Firebase Console → Authentication →
   Sign-in method.

---

## How to pick up where we left off

1. Read this file top-to-bottom.
2. Read `docs/memorial-roadmap.html` if there's a question about what's
   not done yet.
3. Read `SECURITY-MIGRATION.md` if there's a deploy/admin question.
4. Run `npm test` to confirm the 38-spec suite is still green.
5. Ask Gil what session goal he has — there's usually a specific
   feature in mind (next up: music).

When ending a session that shipped a feature: bump the test count, add
a row to the shipping log, update the "in flight" / "still on the
roadmap" sections, update `last updated`, commit this file alongside
the feature PR.
