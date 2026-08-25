// Normalize the stored axes of documents that still carry the pre-rename type `"group"` — both regular
// group documents and class-wide collaborative documents, which share the generic axes type.
//
// Three scope-selected passes plus the type rename, committed as ONE merged write per document. Scope
// selects which of the axis passes a document falls into: a group-scoped document carries a groupId; a
// class-wide document does not.
//
//   every matched document                  -> { type: "axes" }
//   missing `axisProfile`                   -> { axisProfile: "group" | "classWide" }
//   group-scoped, missing `concurrent`      -> { concurrent: true, kind: "group" }
//   class-wide, missing curriculum scope    -> { investigation: null, problem: null }
//
// The passes are merged per document rather than committed independently because `type` is the query's
// own key: the driving query below is `where("type", "==", "group")`, so the instant a document's
// `type` lands as "axes" it stops matching and a re-run can never see it again to retry a failed axis-
// field write. Committing `type` in a separate batch from the axis fields would make write order
// load-bearing across the 400-document chunk boundary — a document whose `type` landed while its
// axis-field write failed would be permanently half-migrated with no recovery path. Merging also keeps
// a document that several passes select to one write rather than one per pass.
//
// The profile pass records which axis profile a document was created from
// (src/models/document/document-axis-profiles.ts), which documents created since that landed already
// carry. It is what a later migration selects on when it changes what a profile means, so it has to
// cover the documents that predate the field. It is also the last migration that has to identify a
// document by its axis values rather than by a stored cohort key — which is why it derives the name
// from scope here rather than from `kind`: a class-wide document's kind is whatever its unit declared,
// and a script that runs outside the app cannot resolve unit-declared kinds through the registry.
//
// The concurrent pass restores the concurrent history manager for group documents that carry no stored
// `concurrent` value. The scope pass states a class-wide document's absent curriculum scope explicitly,
// which is what makes it findable by Sort Work's unit-scoped query. All of them are additive and
// batched; re-running is a no-op because the query no longer matches.
//
// Write volume changed shape with the type rename: every matched document now gets a write (`snap.size`
// of them), not just the ones needing a `concurrent`/scope/profile backfill as before. Size a dry-run
// count or duration estimate off `snap.size`, not off the individual passes' counts.
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
// firestore.rules) transitionally allows any class member to set `concurrent` on an axes-typed
// document. Once this script has been run against every environment, tighten that rule so
// `concurrent` is settable only at document creation, and delete concurrentChangeOk — and constrain
// isValidDocumentCreateRequest in firestore.rules alongside it, since it constrains neither
// `concurrent` nor `uid` today: a truthy `concurrent` at create should imply the document is
// axes-typed, and/or the create should require userIsRequestUser(), or a class member can create a
// new document stamped with a classmate's `uid` and `concurrent: true`.
//
// The concurrent pass also unblocks a second cleanup: getDocumentTitle (src/models/document/document-kinds.ts)
// selects the group-document title on the axes type plus a groupId, because a group document may carry
// no `kind`. Once every group document has one, that check becomes `kind == "group"`.

import type { Firestore } from "firebase-admin/firestore";

export interface BackfillResult {
  total: number;
  concurrentUpdated: number;
  scopeUpdated: number;
  profileUpdated: number;
  typeUpdated: number;
}

// The profile names, kept in sync with src/models/document/document-axis-profiles.ts by the unit test.
// They are repeated rather than imported because scripts/ compiles on its own, against its own
// package.json, and does not resolve modules from src.
const kGroupProfileName = "group";
const kClassWideProfileName = "classWide";

/**
 * Run all three backfill passes plus the type rename, as one merged write per document. Pure (no
 * admin initialization) so it can be unit-tested with a mock Firestore.
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
  const needingProfile = snap.docs.filter((d) => !d.get("axisProfile"));

  log(`group-typed docs: ${snap.size} total, ` +
      `${needingConcurrent.length} missing concurrent, ${needingScope.length} missing curriculum scope, ` +
      `${needingProfile.length} missing an axis profile, ${snap.size} needing the type rename`);
  if (dryRun) {
    log("DRY RUN — set APPLY=1 to write");
    return { total: snap.size, concurrentUpdated: 0, scopeUpdated: 0, profileUpdated: 0, typeUpdated: 0 };
  }

  // One merged write per document, not one per pass. `type` is the query's own key (see above), so a
  // document whose `type` write committed separately from — and ahead of — its axis-field write would
  // drop out of the query and could never be found again to finish migrating. The passes overlap each
  // other as well, and two batched writes to the same document cost twice as much for the same result.
  const fields = new Map<FirebaseFirestore.DocumentReference, Record<string, unknown>>();
  const fieldsFor = (ref: FirebaseFirestore.DocumentReference) => {
    const existing = fields.get(ref);
    if (existing) return existing;
    const created: Record<string, unknown> = {};
    fields.set(ref, created);
    return created;
  };

  // Every returned document still stores the old type, by definition of the query.
  for (const d of snap.docs) {
    Object.assign(fieldsFor(d.ref), { type: "axes" });
  }
  for (const d of needingProfile) {
    // Scope is the only thing that separates the two profiles this query can return, and it is the same
    // split the passes below select on: a groupId means the group profile, its absence the class-wide one.
    const axisProfile = d.get("groupId") ? kGroupProfileName : kClassWideProfileName;
    Object.assign(fieldsFor(d.ref), { axisProfile });
  }
  for (const d of needingConcurrent) {
    Object.assign(fieldsFor(d.ref), { concurrent: true, kind: "group" });
  }
  for (const d of needingScope) {
    Object.assign(fieldsFor(d.ref), { investigation: null, problem: null });
  }

  let batch = db.batch();
  let n = 0;
  for (const [ref, data] of fields) {
    batch.set(ref, data, { merge: true });
    if (++n % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (n % 400 !== 0) {
    await batch.commit();
  }

  log(`updated ${needingConcurrent.length} concurrent, ${needingScope.length} curriculum scope, ` +
      `${needingProfile.length} axis profile, ${snap.size} type`);
  return {
    total: snap.size,
    concurrentUpdated: needingConcurrent.length,
    scopeUpdated: needingScope.length,
    profileUpdated: needingProfile.length,
    typeUpdated: snap.size,
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
