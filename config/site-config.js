// ──────────────────────────────────────────────────────────────
// Yoav Agmon Memorial — Site Configuration
//
// Loaded as a regular <script> before everything else, so it's
// available to both the Firebase module script and the inline
// app script via window.SITE_CONFIG.
//
// IMPORTANT — these values are PUBLIC IDENTIFIERS, not secrets:
//   • Firebase web config is meant to be public; security comes
//     from Firestore rules + Firebase Auth, not from hiding the
//     API key. See firestore.rules.
//   • Drive API key is HTTP-referrer-restricted in Google Cloud
//     so only requests from gilinaveh.github.io will use it.
//   • OAuth client ID is public by design.
//
// Future: split into site-config.dev.js / .staging.js / .prod.js
// when the 3-tier dev environment lands (Phase 5 in the roadmap).
// At that point a build step (Vite) will inject the right one
// per environment via .env files.
// ──────────────────────────────────────────────────────────────
window.SITE_CONFIG = {
  firebase: {
    apiKey:            "AIzaSyDUITgvQ95rsJzD_7Y0Cz6BJwcMAGg1zyA",
    authDomain:        "yoav-memorial-7a8a3.firebaseapp.com",
    projectId:         "yoav-memorial-7a8a3",
    storageBucket:     "yoav-memorial-7a8a3.firebasestorage.app",
    messagingSenderId: "654575963485",
    appId:             "1:654575963485:web:05c9ae07f4c10b4881ecb4"
  },

  drive: {
    folderId: '1YdyRDpRVCXuTG9s6DmecrjkphfNN_3HP',
    apiKey:   'AIzaSyAkd33J8OK8WY9PtyGEeKrcGLQ33ad16rA',
    clientId: '403039923089-7u9pje36ubs60vto6sqlq6rrrks4a8pb.apps.googleusercontent.com'
  },

  appCheck: {
    // To enable Firebase App Check (blocks scripts hitting your project
    // from outside this domain): register a reCAPTCHA Enterprise site
    // key for gilinaveh.github.io at console.cloud.google.com/security/recaptcha,
    // paste the key string below, and turn on Enforcement in the Firebase
    // console under App Check → Apps. See SECURITY-MIGRATION.md.
    //
    // Leaving null keeps App Check off — the safe default that won't
    // break the live site.
    recaptchaSiteKey: null
  }
};
