// Normalize the stored axes of `type == "group"` documents — both regular group documents and
// class-wide collaborative documents, which share that transitional type.
//
// Two independent passes over one collection-group query, selected by scope so they cover disjoint
// sets. A group-scoped document carries a groupId; a class-wide document does not.
//
//   group-scoped, missing `concurrent`      -> { concurrent: true, kind: "group" }
//   class-wide, missing curriculum scope    -> { investigation: null, problem: null }
//
// The first pass restores the concurrent history manager for group documents that carry no stored
// `concurrent` value. The second states a class-wide document's absent curriculum scope
// explicitly, which is what makes it findable by Sort Work's unit-scoped query. Both are additive,
// idempotent, and batched.
//
// Requires a Firebase service account key at scripts/serviceAccountKey.json (see scripts/README.md).
// The `documents` collection-group query needs a single-field COLLECTION_GROUP index on `type`
// (firestore.indexes.json; deploy with `firebase deploy --only firestore:indexes`, or use the
// one-click link Firestore prints on first run).
//
// Dry run (reports counts, writes nothing):   cd scripts && npx tsx backfill-group-document-axes.ts
// Apply (performs the writes):                cd scripts && APPLY=1 npx tsx backfill-group-document-axes.ts
//
// This script authenticates as a service account, so it writes past Firestore rules regardless of
// what they allow. The client-side backfill in src/lib/db.ts does not: it merge-updates `concurrent`
// as an ordinary authenticated user, which is why the Firestore rule (concurrentChangeOk in
// firestore.rules) transitionally allows any class member to set `concurrent` on a `type == "group"`
// document. Once this script has been run against every environment, tighten that rule so
// `concurrent` is settable only at document creation, and delete concurrentChangeOk.

import type { Firestore } from "firebase-admin/firestore";

export interface BackfillResult {
  total: number;
  concurrentUpdated: number;
  scopeUpdated: number;
}

/**
 * Run both backfill passes. Pure (no admin initialization) so it can be unit-tested with a mock
 * Firestore.
 */
export async function backfillGroupDocumentAxes(
  db: Firestore,
  { dryRun = true, log = console.log }: { dryRun?: boolean; log?: (message: string) => void } = {}
): Promise<BackfillResult> {
  const snap = await db.collectionGroup("documents").where("type", "==", "group").get();

  // Select each pass by scope, not by the value it is about to write: a partial write could leave a
  // class-wide document without `concurrent`, and stamping it kind:"group" would break both its
  // title resolution and its canonical-pointer slot (the slot label is the kind).
  const needingConcurrent = snap.docs.filter((d) => !!d.get("groupId") && d.get("concurrent") !== true);
  const needingScope = snap.docs.filter((d) =>
    !d.get("groupId") && (d.get("investigation") === undefined || d.get("problem") === undefined));

  log(`group-typed docs: ${snap.size} total, ` +
      `${needingConcurrent.length} missing concurrent, ${needingScope.length} missing curriculum scope`);
  if (dryRun) {
    log("DRY RUN — set APPLY=1 to write");
    return { total: snap.size, concurrentUpdated: 0, scopeUpdated: 0 };
  }

  const writes = [
    ...needingConcurrent.map((d) => ({ ref: d.ref, data: { concurrent: true, kind: "group" } })),
    ...needingScope.map((d) => ({ ref: d.ref, data: { investigation: null, problem: null } })),
  ];

  let batch = db.batch();
  let n = 0;
  for (const write of writes) {
    batch.set(write.ref, write.data, { merge: true });
    if (++n % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (n % 400 !== 0) {
    await batch.commit();
  }

  log(`updated ${needingConcurrent.length} concurrent, ${needingScope.length} curriculum scope`);
  return {
    total: snap.size,
    concurrentUpdated: needingConcurrent.length,
    scopeUpdated: needingScope.length,
  };
}

async function main() {
  // Imported lazily so the Jest test can import backfillGroupDocumentAxes without loading
  // firebase-admin or the import.meta-using script-utils module.
  const admin = (await import("firebase-admin")).default;
  const { getScriptRootFilePath } = await import("./lib/script-utils.js");
  admin.initializeApp({
    credential: admin.credential.cert(getScriptRootFilePath("serviceAccountKey.json")),
  });
  const result = await backfillGroupDocumentAxes(admin.firestore(), { dryRun: process.env.APPLY !== "1" });
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
