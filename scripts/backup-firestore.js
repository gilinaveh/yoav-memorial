#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// Daily Firestore backup
//
// Reads every document from /candles, /comments, /stories, /admins
// using a service-account credential, writes one JSON file per run to
// backups/yoav-memorial-backup-<timestamp>.json, and prints a summary
// to stdout.
//
// Designed to run inside .github/workflows/backup.yml — that workflow
// supplies the service-account JSON via the FIREBASE_SERVICE_ACCOUNT
// environment variable and uploads the resulting file as a GitHub
// Actions artifact (90-day retention by default).
//
// Run locally:
//   FIREBASE_SERVICE_ACCOUNT="$(cat ~/path/to/service-account.json)" \
//     node scripts/backup-firestore.js
//
// Cost: $0 — uses GitHub Actions free minutes + Firestore free reads.
// A typical run reads <500 docs which is well under the daily quota.
// ─────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';

const COLLECTIONS = ['candles', 'comments', 'stories', 'admins'];
const OUT_DIR     = 'backups';

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('ERROR: FIREBASE_SERVICE_ACCOUNT env var is not set.');
    console.error('       In CI: add it as a GitHub Actions secret.');
    console.error('       Locally: export FIREBASE_SERVICE_ACCOUNT="$(cat path/to/key.json)"');
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('ERROR: FIREBASE_SERVICE_ACCOUNT is not valid JSON:', e.message);
    process.exit(1);
  }
}

function timestamp() {
  // ISO date-only (Israel timezone for filename clarity).
  // The workflow cron uses UTC, but humans reading filenames think in
  // local time — pick noon-ish Asia/Jerusalem to avoid ambiguity.
  const now = new Date();
  const il  = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const yyyy = il.getFullYear();
  const mm   = String(il.getMonth() + 1).padStart(2, '0');
  const dd   = String(il.getDate()).padStart(2, '0');
  const hh   = String(il.getHours()).padStart(2, '0');
  const mi   = String(il.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}${mi}`;
}

function isoTime(value) {
  // Firestore Timestamps come back as { _seconds, _nanoseconds }.
  // Normalise to ISO strings so the JSON is human-readable.
  if (value && typeof value === 'object' && '_seconds' in value) {
    return new Date(value._seconds * 1000).toISOString();
  }
  return value;
}

function normaliseDoc(doc) {
  const out = { _id: doc.id };
  for (const [k, v] of Object.entries(doc.data())) {
    out[k] = isoTime(v);
  }
  return out;
}

async function exportCollection(db, name) {
  const snap = await db.collection(name).get();
  return snap.docs.map(normaliseDoc);
}

async function main() {
  const serviceAccount = loadServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const start = Date.now();
  const ts    = timestamp();

  const data = {
    exportedAt:  new Date().toISOString(),
    timezone:    'Asia/Jerusalem',
    projectId:   serviceAccount.project_id,
    schemaVersion: 1,
    collections: {}
  };

  console.log(`📦 Backing up Firestore (${serviceAccount.project_id}) at ${ts}…`);
  for (const name of COLLECTIONS) {
    const docs = await exportCollection(db, name);
    data.collections[name] = docs;
    console.log(`   /${name}\t${docs.length} docs`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `yoav-memorial-backup-${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));

  const totalDocs = COLLECTIONS.reduce((n, c) => n + data.collections[c].length, 0);
  const sizeKb    = (fs.statSync(outPath).size / 1024).toFixed(1);
  const elapsed   = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`✅ Wrote ${outPath} (${sizeKb} KB, ${totalDocs} docs, ${elapsed}s)`);
}

main().catch(e => {
  console.error('❌ Backup failed:', e);
  process.exit(1);
});
