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

## Comment moderation queue (P0-7) — deploy steps

This branch (`feature/moderation-queue`) introduces a `status` field on
every comment and story:

  - `pending`   — visitor just submitted; not visible on the public site
  - `approved`  — admin reviewed; appears normally
  - `rejected`  — admin reviewed and chose to hide; kept for audit

Visitors see a clear "awaiting approval" toast on submit, and a static
note under the comment form so they're not confused when their post
doesn't appear immediately. Admins get a new **Moderation Queue** panel
inside the Messages section (only visible after admin login) with
Approve / Reject / Delete buttons per pending entry.

### Deploy order — run these in sequence to avoid any visible outage

The site code, the migration, and the new Firestore rules each depend on
the others, so order matters. Here's the safe sequence:

#### 1. Run the migration (BEFORE merging or publishing rules)

This backfills `status: 'approved'` on every existing comment and story
so they stay visible after the new rules go live. It's idempotent and
re-runnable.

```bash
cd ~/Projects/yoav-memorial
git checkout feature/moderation-queue   # or wherever the script lives

# Use the same service-account key set up for the daily backup
export FIREBASE_SERVICE_ACCOUNT="$(cat ~/path/to/service-account.json)"

# Optional preview of what would change
node scripts/migrate-add-status.js --dry-run

# Actually write
node scripts/migrate-add-status.js
```

Expected output:

```
📥 Backfilling status='approved' on existing docs…
   /comments    3 migrated, 0 already had status
   /stories     5 migrated, 0 already had status
✅ Migration done. Updated 8 docs.
```

#### 2. Merge the PR

```bash
git push -u origin feature/moderation-queue
# → click the URL it prints, open PR, merge
```

GitHub Pages auto-deploys the new code. At this point:

- Visitors submit with `status='pending'` — but the OLD rules don't
  enforce that, they're just added.
- The new public listener queries `where('status', '==', 'approved')`
  — this still works because step 1 backfilled everything to approved.
- New submissions are pending; they DON'T appear publicly because the
  query filters them out — even though the OLD rules would still allow
  reading them.

So between steps 2 and 3, the moderation queue is "soft": pending
items are invisible by query but technically readable by rule. Brief
window with no real exposure since the queries hide them.

#### 3. Publish the new Firestore rules

Open the Firebase Console → Firestore Database → Rules tab. Copy the
contents of `firestore.rules` from the merged main branch into the
editor, click Publish. From this point the rules ALSO enforce
moderation: nobody can read pending entries except admins.

#### 4. Smoke-test as a visitor

In an incognito window:

  - Submit a comment.
  - You should see the "awaiting approval" toast.
  - Refresh — your comment is NOT in the list. (Correct! It's pending.)

#### 5. Smoke-test as admin

Log in. Scroll to the Messages section. The new **Moderation Queue**
panel should be visible below the comment form, listing your test
comment from step 4. Click **Approve** — the comment should
disappear from the queue and appear in the public list above. Repeat
with **Reject** and **Delete** to confirm those buttons work.

### Rolling back

If anything breaks badly:

  - Revert the Firestore rules to the previous version (Firebase
    Console → Rules → Version history → restore).
  - Revert the merge commit on `main`. GitHub Pages re-deploys the
    previous code.
  - Existing pending docs stay in Firestore (harmless; just not
    visible to anyone). You can delete them later from the console
    or with the restore script.

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

---

## Daily automated Firestore backup (P1-8) — setup

A GitHub Actions workflow now exports every Firestore collection
to JSON every night at midnight Israel time, and on demand. Backups
are stored as workflow artifacts with 90-day retention.

This requires **two one-time setup steps** the first time it runs:

### 1. Create a service account in Google Cloud

Open <https://console.cloud.google.com/iam-admin/serviceaccounts?project=yoav-memorial-7a8a3>.

1. Click **+ Create Service Account** (top of the page).
2. **Service account name:** `firestore-backup-bot`
   **Service account ID:** `firestore-backup-bot` (auto-fills)
   **Description:** "Read-only backup runner for GitHub Actions"
   Click **Create and continue**.
3. **Grant this service account access** — choose role
   **Cloud Datastore User** (gives read+write to Firestore; we
   need write for the restore script too). Click **Continue**.
4. Skip the optional "Grant users access" step → **Done**.
5. Back on the service accounts list, click your new
   `firestore-backup-bot` row.
6. Go to the **Keys** tab → **Add key** → **Create new key**
   → choose **JSON** → **Create**. A `.json` file downloads.
   *Treat this file like a password — anyone with it can read/write
   your database. Don't commit it. Don't email it.*

### 2. Add the key as a GitHub Secret

1. Open the JSON file you downloaded in any text editor.
2. **Select all** (Cmd+A) → **copy** (Cmd+C). The whole thing,
   curly brace to curly brace.
3. Open <https://github.com/gilinaveh/yoav-memorial/settings/secrets/actions>.
4. Click **New repository secret**.
5. **Name:** `FIREBASE_SERVICE_ACCOUNT` (exact spelling, all caps,
   underscores).
   **Value:** paste the JSON contents.
   Click **Add secret**.
6. **Delete the JSON file from your Downloads folder.** It's now
   stored encrypted in GitHub; you don't need the local copy.

### 3. Trigger the first run manually

The cron schedule kicks in tonight, but you can run it now to verify:

1. Open <https://github.com/gilinaveh/yoav-memorial/actions/workflows/backup.yml>.
2. Click the **Run workflow** dropdown on the right → **Run workflow**.
3. After ~30 seconds the run finishes. Click into it.
4. Scroll down → **Artifacts** section → download
   `yoav-memorial-firestore-backup`.
5. Unzip — you'll see `yoav-memorial-backup-<timestamp>.json` with
   every candle, comment, story, and admin doc inside.

### 4. (Optional) Restore from a backup

If you ever need to roll back:

```bash
# Get the service account JSON onto your machine (from 1Password,
# a USB stick, wherever you put it after setup).
export FIREBASE_SERVICE_ACCOUNT="$(cat ~/path/to/key.json)"

# Restore everything from a downloaded backup file
npm run restore -- backups/yoav-memorial-backup-2026-04-26T0000.json

# Or just one collection
npm run restore -- backups/yoav-memorial-backup-...json --only comments
```

The restore script uses the same service-account credential and
preserves document IDs, so a restored doc is byte-identical to the
original (Firestore Timestamps are reconverted from the JSON's ISO
strings).

### Cost

- GitHub Actions: free (uses ~30 seconds of your 2,000 free
  minutes/month).
- Firestore reads: free (a typical run reads <500 docs, well under
  the 50,000-doc daily free quota).
- Storage: free (artifacts < 500MB don't count against billing on
  public repos).

**Total recurring cost: $0.**

### Long-term retention

90 days of artifacts is the default. If you want to keep backups
longer, the simplest options are:

1. **Manual archival**: download an artifact monthly and stash it
   in Drive / iCloud / wherever. Set a calendar reminder for the
   1st of each month.
2. **Push to a `backups` branch**: extend the workflow to also
   commit each backup to a long-lived `backups` branch in this
   repo. Forever retention, no extra cost. We can wire that up
   later if you want.
3. **Push to GCS**: requires upgrading Firebase to Blaze
   (pay-as-you-go) plan and creating a Cloud Storage bucket.
   Costs pennies per month for our data volume.
