#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// One-time migration: add status='approved' to every existing comment
// and story.
//
// Why: P0-7 introduces a moderation queue. The new rules expect each
// /comments and /stories doc to have a `status` field. Without this
// migration, every pre-moderation doc would either be invisible to
// visitors (because the public listener filters to status=='approved')
// or fall back to the rules' legacy compat clause (slower path).
//
// Idempotent: only writes status='approved' to docs that don't already
// have a status field. Re-runs are a no-op.
//
// Run BEFORE merging the moderation PR + publishing the new rules:
//   FIREBASE_SERVICE_ACCOUNT="$(cat ~/path/to/service-account.json)" \
//     node scripts/migrate-add-status.js
//
// Run with --dry-run to see what would change without touching the db.
// ─────────────────────────────────────────────────────────────────────

import admin from 'firebase-admin';

const COLLECTIONS = ['comments', 'stories'];
const DRY_RUN     = process.argv.includes('--dry-run');

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('ERROR: FIREBASE_SERVICE_ACCOUNT env var is not set.');
    console.error('       export FIREBASE_SERVICE_ACCOUNT="$(cat path/to/key.json)"');
    process.exit(1);
  }
  return JSON.parse(raw);
}

async function migrateCollection(db, name) {
  const snap = await db.collection(name).get();
  let migrated = 0;
  let skipped  = 0;

  // Firestore batches are limited to 500 ops; for our data volume one
  // batch is fine, but write the loop generally so it scales.
  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of snap.docs) {
    if (doc.data().status) {
      skipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(`   would migrate /${name}/${doc.id}`);
    } else {
      batch.update(doc.ref, { status: 'approved' });
      opsInBatch++;
      if (opsInBatch >= 400) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }
    migrated++;
  }

  if (!DRY_RUN && opsInBatch > 0) await batch.commit();

  console.log(`   /${name}\t${migrated} migrated, ${skipped} already had status`);
  return { migrated, skipped };
}

async function main() {
  admin.initializeApp({ credential: admin.credential.cert(loadServiceAccount()) });
  const db = admin.firestore();

  console.log(`📥 Backfilling status='approved' on existing docs${DRY_RUN ? ' (DRY RUN)' : ''}…`);
  let totalMigrated = 0;
  for (const name of COLLECTIONS) {
    const { migrated } = await migrateCollection(db, name);
    totalMigrated += migrated;
  }

  if (DRY_RUN) {
    console.log(`\n🔎 Dry run complete. Would have migrated ${totalMigrated} docs.`);
    console.log(`   Re-run without --dry-run to actually write.`);
  } else {
    console.log(`\n✅ Migration done. Updated ${totalMigrated} docs.`);
  }
}

main().catch(e => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
