/**
 * backfill-group-concurrent.js
 *
 * One-shot Firestore backfill: stamp `{ concurrent: true, kind: "group" }` onto every existing
 * `type == "group"` document that lacks the `concurrent` field. Group documents created before the
 * concurrent axis shipped do not carry it; this makes existing data consistent so the history manager
 * reads `concurrent` from storage. Additive, idempotent, batched.
 *
 * Requires a Firebase service account key: log into the Firebase console for the target project
 * (collaborative-learning-staging, then collaborative-learning-ec215), Project Settings → Service
 * Accounts → "Generate new private key", save it as ./serviceAccountKey.json (gitignored — never commit).
 *
 * The `documents` collection-group query needs a single-field COLLECTION_GROUP index on `type`
 * (see firestore.indexes.json; deploy with `firebase deploy --only firestore:indexes`, or follow the
 * one-click link Firestore prints on first run).
 *
 * Usage (DRY RUN — reports counts, writes nothing):
 *   node migrations/backfill-group-concurrent.js
 * Usage (APPLY — performs the writes):
 *   APPLY=1 node migrations/backfill-group-concurrent.js
 */

/**
 * @param {*} db a Firestore instance (collectionGroup/where/get, batch, doc refs)
 * @param {{ dryRun?: boolean, log?: (msg: string) => void }} [opts]
 * @returns {Promise<{ total: number, updated: number }>}
 */
async function backfillGroupConcurrent(db, { dryRun = true, log = console.log } = {}) {
  const snap = await db.collectionGroup("documents").where("type", "==", "group").get();
  const needing = snap.docs.filter((d) => d.get("concurrent") !== true);
  log(`group docs: ${snap.size} total, ${needing.length} missing concurrent`);
  if (dryRun) {
    log("DRY RUN — set APPLY=1 to write");
    return { total: snap.size, updated: 0 };
  }
  let batch = db.batch();
  let n = 0;
  let updated = 0;
  for (const doc of needing) {
    batch.set(doc.ref, { concurrent: true, kind: "group" }, { merge: true });
    if (++n === 400) {
      await batch.commit();
      updated += n;
      batch = db.batch();
      n = 0;
    }
  }
  if (n > 0) {
    await batch.commit();
    updated += n;
  }
  log(`updated ${updated} documents`);
  return { total: snap.size, updated };
}

async function main() {
  const admin = require("firebase-admin");
  const serviceAccount = require("./serviceAccountKey.json");
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const result = await backfillGroupConcurrent(admin.firestore(), { dryRun: process.env.APPLY !== "1" });
  console.log("done", result);
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { backfillGroupConcurrent };
