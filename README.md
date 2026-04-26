# yoav-memorial

[![Tests](https://github.com/gilinaveh/yoav-memorial/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/gilinaveh/yoav-memorial/actions/workflows/test.yml)
[![GitHub Pages](https://img.shields.io/badge/site-live-27ae60?logo=github)](https://gilinaveh.github.io/yoav-memorial/)

In memory of Yoav Agmon — a public memorial site.

🌐 **Live:** <https://gilinaveh.github.io/yoav-memorial/>

## Stack

- **Frontend:** single static `index.html` (vanilla JS, Hebrew + English)
- **Database:** Firebase Firestore (`yoav-memorial-7a8a3`) for candles, comments, stories, admins
- **Storage:** Google Drive folder for photos and videos
- **Auth:** Firebase Auth (email/password for admins, anonymous for visitors)
- **Hosting:** GitHub Pages (auto-deploys from `main`)
- **Tests:** [Playwright](https://playwright.dev/) — see [`tests/`](tests/)

## Roadmap

The full audit, plan, and what's been shipped is in
[`docs/memorial-roadmap.html`](docs/memorial-roadmap.html). Live preview:

📋 <https://gilinaveh.github.io/yoav-memorial/docs/memorial-roadmap.html>

## Running tests locally

```bash
npm install
npx playwright install --with-deps chromium
npm test
```

See [`tests/README.md`](tests/README.md) for what's covered, what's not, and how to add more.

## Deploying changes

Every push to `main` auto-deploys to the live GitHub Pages site within a
minute or two. The standard workflow:

```bash
# 1. branch
git checkout main && git pull
git checkout -b feature/my-change

# 2. work
# ... edit files ...
git add -A && git commit -m "Describe the change"

# 3. push and open PR
git push -u origin feature/my-change
# → click the URL it prints, open PR, merge

# 4. clean up
git checkout main && git pull
git branch -d feature/my-change
```

## Admin setup

Adding a new admin requires two steps in the Firebase Console:

1. **Authentication → Users → Add user** — create an email/password account.
2. **Firestore → admins (root collection) → Add document** — document ID
   must be the new user's UID (visible in the Authentication tab),
   field: `name` (string).

Full step-by-step (including troubleshooting the App Check / CSP /
secrets-to-`.env` migration) lives in [`SECURITY-MIGRATION.md`](SECURITY-MIGRATION.md).

## Repo map

```
.
├── index.html                    # the site
├── config/site-config.js          # Firebase + Drive config (public, not secret)
├── favicon.svg                    # gold star icon
├── firestore.rules                # security rules
├── firebase.json                  # Firebase CLI config
├── docs/memorial-roadmap.html     # roadmap (renders on Pages)
├── tests/                         # Playwright tests
│   ├── smoke.spec.js
│   ├── xss.spec.js
│   └── auth-ui.spec.js
├── .github/workflows/test.yml     # CI runs Playwright on every PR
├── SECURITY-MIGRATION.md          # admin / Firestore / App Check setup
└── README.md                      # you are here
```
