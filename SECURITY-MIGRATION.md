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

## What's NOT done in this branch

These are tracked in the roadmap and deferred to later phases:

- **App Check** (P0-4) — blocks scripts hitting your Firebase project from
  outside the real domain. Worth enabling once the site is live and you
  see the domain holds steady.
- **Content Security Policy headers** (P0-5) — defence-in-depth even if
  the XSS escape ever has a hole. Belongs at the hosting layer
  (`_headers` file on Netlify, `vercel.json` on Vercel).
- **Secrets out of source** (P0-6) — Firebase config is *technically*
  fine in client source (it's a public identifier), but moving to
  `.env` per environment makes the dev/staging/prod split possible.
- **Comment moderation queue** (P0-7) — comments still publish
  immediately. The rules' length caps and XSS escape mean the worst case
  is now "ugly text" rather than "executes code", but a moderation queue
  keeps emotional content from surprising the family.
- **Drive folder sharing audit** (P0-8) — manual review needed on the
  Drive side; nothing to deploy.
