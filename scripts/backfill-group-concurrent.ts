// Backfill the `concurrent` axis onto pre-existing group documents.
//
// Group documents created before the `concurrent` field existed have no stored `concurrent`, so their
// history manager would run in single-writer mode. This stamps `{ concurrent: true, kind: "group" }` onto
// every `type == "group"` document that lacks `concurrent`. Additive, idempotent, batched.
//
// Requires a Firebase service account key at scripts/serviceAccountKey.json (see scripts/README.md). The
// `documents` collection-group query needs a single-field COLLECTION_GROUP index on `type`
// (firestore.indexes.json; deploy with `firebase deploy --only firestore:indexes`, or use the one-click link
// Firestore prints on first run).
//
// Dry run (reports counts, writes nothing):   cd scripts && npx tsx backfill-group-concurrent.ts
// Apply (performs the writes):                cd scripts && APPLY=1 npx tsx backfill-group-concurrent.ts

import type { Firestore } from "firebase-admin/firestore";

export interface BackfillResult {
  total: number;
  updated: number;
}

/**
 * Stamp `{ concurrent: true, kind: "group" }` onto every `type == "group"` document missing `concurrent`.
 * Pure (no admin initialization) so it can be unit-tested with a mock Firestore.
 */
export async function backfillGroupConcurrent(
  db: Firestore,
  { dryRun = true, log = console.log }: { dryRun?: boolean; log?: (message: string) => void } = {}
): Promise<BackfillResult> {
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
  // Imported lazily so the Jest test can import backfillGroupConcurrent without loading firebase-admin
  // or the import.meta-using script-utils module.
  const admin = (await import("firebase-admin")).default;
  const { getScriptRootFilePath } = await import("./lib/script-utils.js");
  admin.initializeApp({
    credential: admin.credential.cert(getScriptRootFilePath("serviceAccountKey.json")),
  });
  const result = await backfillGroupConcurrent(admin.firestore(), { dryRun: process.env.APPLY !== "1" });
  console.log("done", result);
  process.exit(0);
}

// Run only when invoked directly (via tsx), never when imported by the Jest test.
if (!process.env.JEST_WORKER_ID) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
