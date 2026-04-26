# Phase 1 Security Migration — Deploy Guide

This branch (`feature/security-p0`) closes the three exploitable issues in
the original site:

| #     | Fix                                                         | Where                            |
| ----- | ----------------------------------------------------------- | -------------------------------- |
| P0-1  | Plaintext admin passwords removed; Firebase Auth wired in   | `index.html`                     |
| P0-2  | Firestore is locked down with security rules                | `firestore.rules`                |
| P0-3  | Visitor input is HTML-escaped before render (XSS closed)    | `index.html` — `escapeHtml()`    |

The deploy has **three steps in the Firebase Console** (one-time), then
**two steps in your terminal**. Roughly 10 minutes start to finish.

---

## 1. Firebase Console — enable Auth providers

Open <https://console.firebase.google.com/project/yoav-memorial-7a8a3>.

**Authentication → Sign-in method → enable two providers:**

1. **Anonymous** — used for visitors so they can light candles and post
   comments under the new rules. No UI prompt is shown to them; sign-in
   fires automatically on page load.
2. **Email / Password** — used for admin login. Disable "Email link
   (passwordless)" unless you want it.

## 2. Firebase Console — create admin accounts

For each family member who needs admin access:

**Authentication → Users → Add user:**

- email: e.g. `tzafrir@example.com`
- password: at least 8 characters; share it through a private channel
  (signal, in-person, encrypted note — **not** email).

After saving, copy the **User UID** column for that account — it's a long
string like `iE3kQ9rT...`. You'll need it in step 3.

## 3. Firebase Console — register the admin in Firestore

The rules check `/admins/{uid}` — a doc must exist there for delete
operations to succeed.

**Firestore Database → Start collection** (only the first time):

- Collection ID: `admins`

**Then for each admin UID:**

- Document ID: paste the UID from step 2
- Field: `name` (string) → e.g. `"Tzafrir"`
  (the field is informational; only the doc's existence is checked)

Repeat for every admin.

> **Tip:** if you later want to revoke admin access without deleting the
> account, just delete the `/admins/{uid}` doc. The user will still be
> able to log in and read everything; they simply won't be able to delete
> comments or stories.

## 4. Terminal — deploy the rules

From the project root:

```bash
# one-time: install the Firebase CLI if you don't have it
npm install -g firebase-tools

# one-time: log in
firebase login

# deploy ONLY the rules (safer than `firebase deploy`)
firebase deploy --only firestore:rules
```

You should see something like:

```
✔  cloud.firestore: rules file firestore.rules compiled successfully
✔  firestore: released rules firestore.rules to cloud.firestore
✔  Deploy complete!
```

## 5. Terminal — push the code

```bash
git push origin feature/security-p0
```

Then on GitHub: open a PR → review the diff → merge to `main`.

If the site is deployed via Netlify/Vercel/GitHub Pages, the merge
auto-deploys. Otherwise, copy the new `index.html` to wherever the site
is hosted.

---

## Smoke test after deploy

Run through this checklist on the live site:

| What                                           | Expected                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| Open the site in an incognito window           | loads, photos appear, candles/comments visible                    |
| Click "Light a candle" without signing in      | candle appears (anonymous auth happens silently)                  |
| Post a comment with text `<img src=x onerror=alert(1)>` | renders as literal text — no alert                        |
| Click 🔑 → log in with admin email/password    | "Welcome, …" toast; admin bar appears                             |
| Try to log in with non-admin email             | "This account is not registered as an admin"; auto signed-out     |
| As admin, click 🗑 on a comment                 | comment disappears                                                |
| Log out                                        | "Logged out successfully"; admin bar hidden; can still post       |

If any row fails, check the browser console — Firebase usually surfaces
a clear error (`permission-denied`, `auth/wrong-password`, etc.).

---

## Rollback

If something breaks badly in production:

```bash
# revert the merge commit on main
git revert -m 1 <merge-commit-sha>
git push origin main

# revert the rules to the previous version (no rules = open db)
firebase firestore:rules:get --release ... | firebase deploy --only firestore:rules
```

Or, simpler, just deploy the `main` branch from before the merge — the
rules deploy is independent.

---

## Phase 1 P1 — landed on `feature/security-p1`

Three more items shipped after the original P0 trio:

### CSP headers (P0-5) — applied via meta tag

A `<meta http-equiv="Content-Security-Policy">` is now in `<head>`
restricting where scripts, styles, fonts, images, and network calls
can come from. If the XSS escape ever has a hole, the browser still
won't load attacker-injected resources from arbitrary origins.

To test that nothing is broken:

1. Hard-refresh the deployed site (`Cmd+Shift+R`).
2. Open the browser console. Look for any line that starts with
   `Refused to load …` or `Content Security Policy: …` — those are
   CSP violations.
3. Click around — light a candle, post a comment, log in as admin,
   open the upload modal, view a photo in the lightbox.
4. If you see violations for a real Google domain we forgot to
   whitelist, add it to the `connect-src` / `script-src` / etc. of
   the meta tag in `index.html` and redeploy.

GitHub Pages doesn't support custom HTTP headers, so HSTS,
`X-Frame-Options`, and `Referrer-Policy` will land when the site
moves to Netlify/Vercel (P1-3 in the roadmap).

### Config extracted to site-config.js (P0-6 — first step)

Firebase + Drive config now lives in `config/site-config.js` and is
exposed as `window.SITE_CONFIG`. Editing values for a different
environment is a one-file change. The full `.env` per environment
(`VITE_FIREBASE_*`) lands when the project gets a Vite build step
in Phase 2 — at which point `site-config.js` becomes
`site-config.dev.js` / `.staging.js` / `.prod.js`.

### Firebase App Check (P0-4) — wired but disabled

The code is in place to initialize App Check with reCAPTCHA
Enterprise, but it's gated on `SITE_CONFIG.appCheck.recaptchaSiteKey`
being non-null. Default is `null`, so App Check stays off and nothing
breaks. To turn it on:

1. Open <https://console.cloud.google.com/security/recaptcha?project=yoav-memorial-7a8a3>.
   Click **Create key** at the top.
2. **Display name:** `yoav-memorial-prod`.
   **Platform type:** Website.
   **Domain list:** add `gilinaveh.github.io` (and your custom
   domain too if you've added one).
   **Save**.
3. After creation, copy the **site key** — it's a long string
   starting with `6L`.
4. Open `config/site-config.js`, find the `appCheck` block, replace
   `null` with the site key in quotes:
   ```js
   appCheck: {
     recaptchaSiteKey: "6Le_paste_your_key_here"
   }
   ```
5. Open the Firebase Console → **App Check** → **Apps** tab →
   click your web app → **Register**, paste the same site key,
   save.
6. **Important — don't enable enforcement yet.** Open the Firebase
   Console → App Check → **APIs** tab → Cloud Firestore → make sure
   it's set to **Unenforced** for now. Same for Authentication.
   Deploy the code, watch the App Check dashboard for a day or two
   to confirm legitimate traffic is being verified, THEN switch
   each API to **Enforced**.

If you skip step 6 and enforce immediately, every visitor without a
valid App Check token gets blocked — including yourself if anything
is misconfigured. The "watch first, enforce later" pattern is the
official Firebase recommendation.

---

## Still NOT done

- **Comment moderation queue** (P0-7) — comments still publish
  immediately. The rules' length caps and XSS escape mean the worst
  case is now "ugly text" rather than "executes code", but a
  moderation queue keeps emotional content from surprising the family.
- ~~**Drive folder sharing audit** (P0-8)~~ — done April 26. Decision
  recorded below.

---

## Drive folder sharing — audit result (April 26, 2026)

**Setting kept:** "Anyone with the link → Viewer" at the
`Yoav Memorial Photos` folder level.

**Why not Restricted:** the site's gallery loads in two stages:

1. `GET drive/v3/files?q='folderId' in parents&...` — *lists* the
   folder using the public API key. This call requires the FOLDER
   itself to be readable.
2. `<img src="https://drive.google.com/thumbnail?id=X">` — *displays*
   each file. The upload code makes every uploaded file individually
   public via `{role:'reader', type:'anyone'}` permissions, so this
   step works regardless of folder-level sharing.

A Restricted folder breaks step 1 (the API key can't read a private
folder), so visitors see an empty gallery even though the individual
files would still render if their IDs were known. We tested this on
April 26 and reverted to "Anyone with the link".

**Residual risk:** the folder ID is present in
`config/site-config.js` (visible in page source), so anyone who views
source could construct `https://drive.google.com/drive/folders/<id>`
and browse the folder in Drive's native UI. For a public memorial
that risk is essentially zero — the photos are intentionally public.

**If true folder privacy is ever needed** (e.g. mixed public/private
content), implement a small Cloud Function that lists files
server-side via a service account, returns just the file IDs to the
page, and keeps the folder Restricted. That's a Phase 2 / Phase 3
task and not currently on the roadmap.
