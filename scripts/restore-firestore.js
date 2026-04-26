#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// Restore Firestore from a backup JSON.
//
// Reads a file produced by scripts/backup-firestore.js and re-writes
// every document to Firestore. Document IDs are preserved.
//
// USE WITH CARE: this OVERWRITES existing documents that share an _id
// with a backup record, and creates docs that don't exist. It does NOT
// delete docs that exist now but weren't in the backup — for that, run
// with --purge (TODO).
//
// Run:
//   FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" \
//     node scripts/restore-firestore.js backups/yoav-memorial-backup-2026-04-26T0000.json
//
// Or to restore a single collection only:
//   ... restore-firestore.js <file.json> --only candles
// ─────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import admin from 'firebase-admin';

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('ERROR: FIREBASE_SERVICE_ACCOUNT env var is not set.');
    process.exit(1);
  }
  return JSON.parse(raw);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
  if (!file) {
    console.error('Usage: restore-firestore.js <backup-file.json> [--only <collection>]');
    process.exit(1);
  }
  return { file, only };
}

async function main() {
  const { file, only } = parseArgs();
  const backup = JSON.parse(fs.readFileSync(file, 'utf-8'));

  admin.initializeApp({ credential: admin.credential.cert(loadServiceAccount()) });
  const db = admin.firestore();

  const collections = only
    ? [only]
    : Object.keys(backup.collections);

  console.log(`📥 Restoring from ${file}`);
  console.log(`   exported: ${backup.exportedAt}`);
  console.log(`   project:  ${backup.projectId}`);
  console.log('');

  let total = 0;
  for (const name of collections) {
    const docs = backup.collections[name];
    if (!docs) {
      console.warn(`   ⚠️  /${name} not in backup — skipped`);
      continue;
    }
    let n = 0;
    const batch = db.batch();
    for (const doc of docs) {
      const { _id, ...data } = doc;
      // Convert ISO strings back to Firestore Timestamps where the
      // field name suggests a timestamp.
      for (const k of Object.keys(data)) {
        if (k.toLowerCase().includes('at') && typeof data[k] === 'string') {
          const d = new Date(data[k]);
          if (!isNaN(d)) data[k] = admin.firestore.Timestamp.fromDate(d);
        }
      }
      batch.set(db.collection(name).doc(_id), data);
      n++;
      total++;
    }
    await batch.commit();
    console.log(`   /${name}\t${n} docs restored`);
  }

  console.log(`\n✅ Restored ${total} docs total.`);
}

main().catch(e => {
  console.error('❌ Restore failed:', e);
  process.exit(1);
});
