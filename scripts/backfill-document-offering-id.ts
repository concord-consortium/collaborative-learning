// Adds the missing `offeringId` to the Firestore metadata of documents kept in an offering.
//
// `isInClassUnitContainer` (src/models/document/document-axes.ts) identifies the offering container by
// the ABSENCE of `offeringId`, so an offering-contained document without one reads as belonging to the
// class's copy of the unit — the wrong container. This script makes the data true so that guard can be
// relied on.
//
// The dry run is the deliverable that matters first: it buckets every candidate by why it landed
// there, per type and per space, and those counts decide what to do about the documents this script
// cannot resolve. APPLY=1 writes only the documents it resolved; every other bucket is reported and
// left untouched.
//
// Requires a Firebase service account key at scripts/serviceAccountKey.json (see scripts/README.md).
// The `documents` collection-group queries need the single-field COLLECTION_GROUP index on `type`.
// It is declared in firestore.indexes.json, but declared is not deployed — each environment needs it
// actually created, and the first query fails outright without one. Deploy with
// `firebase deploy --only firestore:indexes --project <alias>`, or use the one-click link Firestore
// prints in the error. Check the diff against deployed indexes first: an environment may carry
// indexes absent from the file, which a --force deploy would delete.
//
// Dry run (reports counts, writes nothing):   npx tsx scripts/backfill-document-offering-id.ts
// Apply (performs the writes):                APPLY=1 npx tsx scripts/backfill-document-offering-id.ts
//
// TYPES limits the scan to a comma-separated subset of the types below, for sampling a large
// environment before committing to a full sweep. PAGE_SIZE tunes the query page (default 300).
// DATABASE_URL overrides the Realtime Database URL chosen from the credential's project.
//
//   TYPES=planning PAGE_SIZE=1000 npx tsx scripts/backfill-document-offering-id.ts

import type { Firestore } from "firebase-admin/firestore";
// Specified without the `.js` extension that the other scripts here use. This module is loaded by a
// Jest test, and Jest resolves only the extensionless form to the sibling `.ts` file; tsx resolves
// either form, so running the script is unaffected.
import { getOfferingIdFromFirebaseMetadata } from "./lib/document-metadata-lookup";
import type { IMetadataDatabase } from "./lib/document-metadata-lookup";

/**
 * The `type` values of documents kept in an offering, per the `containerType: "offering"` entries in
 * src/models/document/document-kinds.ts. Queried one at a time.
 *
 * "publication" is the problem publication's stored value; ProblemPublication in
 * src/models/document/document-types.ts is the constant's name, not its value.
 *
 * Both "group" and "axes" appear because the generic axes type is mid-rename: which value a document
 * stores depends on whether scripts/backfill-group-document-axes.ts has already run. Accepting both
 * is what lets the two sweep scripts run in either order.
 */
export const kOfferingContainedTypes = [
  "problem", "planning", "publication", "supportPublication", "group", "axes"
] as const;

/** A Firestore root and the Realtime Database path its classes hang off. */
export interface IFirestoreSpace {
  /** Identifies the space in the report, e.g. "authed/learn_concord_org" or "demo/CLUE". */
  label: string;
  firebaseBasePath: string;
}

/**
 * Derive a document's space from its Firestore path. A collection-group query reaches every collection
 * named `documents` anywhere in the database, so an unrecognized root is a real possibility and gets
 * counted rather than guessed at.
 */
export function getSpaceFromFirestorePath(docPath: string): IFirestoreSpace | undefined {
  const [root, name, collection] = docPath.split("/");
  if (!name || collection !== "documents") return undefined;
  // The portal segment is already underscore-escaped in the Firestore path, so it is used as-is.
  if (root === "authed") {
    return { label: `authed/${name}`, firebaseBasePath: `/authed/portals/${name}/classes` };
  }
  if (root === "demo") {
    return { label: `demo/${name}`, firebaseBasePath: `/demo/${name}/portals/demo/classes` };
  }
  return undefined;
}

/**
 * The Firestore roots holding data for the unsecured `appMode` partitions, keyed by user id rather
 * than by portal. These are scratch spaces — scripts/delete-qa-user-data.ts exists to purge one of
 * them — so their documents are out of scope entirely rather than merely unrecognized.
 */
const kTestPartitionRoots = ["qa", "dev", "test"];

/** The partition root a path belongs to, or undefined if it is not one of them. */
export function getTestPartitionLabel(docPath: string): string | undefined {
  const [root, name, collection] = docPath.split("/");
  if (!name || collection !== "documents") return undefined;
  return kTestPartitionRoots.includes(root) ? root : undefined;
}

/** A document whose root matches nothing known still needs a label to be counted under. */
export const kUnknownSpaceLabel = "unknown";

/** How a scanned document is reported in the per-space tallies. */
export function getSpaceLabel(docPath: string): string {
  return getSpaceFromFirestorePath(docPath)?.label ?? getTestPartitionLabel(docPath) ?? kUnknownSpaceLabel;
}

/** Every outcome a scanned document can be counted under. */
export type CountedBucket =
  | "resolved"
  | "alreadySet"
  | "noMetadataNode"
  | "nodeWithoutOfferingId"
  | "unusableDocument"
  | "unknownSpace"
  | "skippedTestPartition"
  | "skippedClassWide"
  | "lookupError";

// `spaceLabel` travels with the classification so the path is parsed once. Deriving it again at the
// counting site is what let a qa/dev document be counted under a bucket that says nothing is wrong
// while being labelled as belonging to no known space.
export type Classification =
  | { kind: "counted"; bucket: CountedBucket; spaceLabel: string }
  | { kind: "lookup"; space: IFirestoreSpace; contextId: string; uid: string; key: string };

const isGenericAxesType = (type: unknown) => type === "group" || type === "axes";

/**
 * Decide what to do with one scanned document, without doing any I/O.
 *
 * The class-wide test comes first, ahead of the `alreadySet` test, on purpose: a class-wide document
 * carrying an `offeringId` should not exist, and reporting it as `alreadySet` would file an anomaly
 * under a bucket that reads like success.
 */
export function classifyDocument(data: any, docPath: string): Classification {
  const spaceLabel = getSpaceLabel(docPath);
  const counted = (bucket: CountedBucket): Classification => ({ kind: "counted", bucket, spaceLabel });
  // Asked first because it is a scope question rather than a property of the document: a scratch
  // partition's documents are not ours to repair whatever else is true of them, and reporting them
  // under any other bucket overstates how much real data the run covered.
  if (getTestPartitionLabel(docPath)) return counted("skippedTestPartition");
  // A generic axes document with no groupId is class-wide: class-unit-contained, correctly without an
  // offering. Writing one would corrupt the guard this script exists to make safe.
  if (isGenericAxesType(data?.type) && !data?.groupId) return counted("skippedClassWide");
  if (data?.offeringId) return counted("alreadySet");
  const space = getSpaceFromFirestorePath(docPath);
  if (!space) return counted("unknownSpace");
  const contextId = data?.context_id;
  const uid = data?.uid;
  const key = data?.key;
  if (!contextId || !uid || !key) return counted("unusableDocument");
  return { kind: "lookup", space, contextId, uid, key };
}

/** One tally per outcome. Kept as a flat record so totals, per-type, and per-space all share a shape. */
export type IBucketCounts = Record<CountedBucket, number>;

export interface IBackfillOfferingIdResult {
  scanned: number;
  written: number;
  totals: IBucketCounts;
  byType: Record<string, IBucketCounts>;
  bySpace: Record<string, IBucketCounts>;
}

const kAllBuckets: CountedBucket[] = [
  "resolved", "alreadySet", "noMetadataNode", "nodeWithoutOfferingId",
  "unusableDocument", "unknownSpace", "skippedTestPartition", "skippedClassWide", "lookupError"
];

const emptyCounts = (): IBucketCounts =>
  Object.fromEntries(kAllBuckets.map((b) => [b, 0])) as IBucketCounts;

/**
 * Run `fn` over `items` a chunk at a time. Latency here is dominated by one small RTDB read per
 * document, so the reads are overlapped; the chunking is what keeps the number in flight fixed
 * regardless of page size.
 */
async function mapInChunks<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  }
  return results;
}

/**
 * Yield each page of one type's documents, ordered by document id.
 *
 * Paginated rather than fetched whole: this query's result set is every document of that type in every
 * space, which will not fit in memory. Ordered by document id because that is the one total order
 * available without a composite collection-group index.
 */
async function* iterateDocuments(db: Firestore, type: string, pageSize: number) {
  let cursor: any;
  for (;;) {
    const base = db.collectionGroup("documents").where("type", "==", type).orderBy("__name__");
    const query = cursor ? (base as any).startAfter(cursor) : base;
    const snapshot = await (query as any).limit(pageSize).get();
    const docs = snapshot.docs;
    if (docs.length === 0) return;
    yield docs;
    if (docs.length < pageSize) return;
    cursor = docs[docs.length - 1];
  }
}

/**
 * The types a run should scan, from a comma-separated `TYPES`. Every name is checked against the known
 * set and an unknown one throws: a typo would otherwise scan nothing and report a confident, empty
 * census, which is indistinguishable from "this type is clean".
 */
export function parseTypes(raw: string | undefined): readonly string[] {
  const requested = (raw ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  if (requested.length === 0) return kOfferingContainedTypes;
  const unknown = requested.filter((t) => !kOfferingContainedTypes.includes(t as any));
  if (unknown.length > 0) {
    throw new Error(`TYPES names unknown type(s): ${unknown.join(", ")}. ` +
      `Known types are: ${kOfferingContainedTypes.join(", ")}`);
  }
  return requested;
}

/** The page size from `PAGE_SIZE`. Rejects anything that is not a positive integer. */
export function parsePageSize(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const size = Number(raw);
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`PAGE_SIZE must be a positive integer, got "${raw}"`);
  }
  return size;
}

/**
 * Census, and optionally repair, the `offeringId` of every offering-contained document.
 *
 * Idempotency works differently here than in scripts/backfill-group-document-axes.ts, whose whole
 * design rests on the field it writes being the field it queries. Firestore cannot query for a missing
 * field, so candidates are found by `type` and filtered in memory on the absence of `offeringId`. A
 * re-run therefore rescans everything; it is still a no-op for anything already repaired, because a
 * repaired document now fails that in-memory filter.
 *
 * Pure of admin initialization so it can be unit tested with a mock Firestore and a mock database.
 */
export async function backfillDocumentOfferingId(
  db: Firestore,
  database: IMetadataDatabase,
  { dryRun = true, log = console.log, pageSize = 300, concurrency = 25,
    types = kOfferingContainedTypes }: {
    dryRun?: boolean; log?: (message: string) => void; pageSize?: number; concurrency?: number;
    types?: readonly string[];
  } = {}
): Promise<IBackfillOfferingIdResult> {
  const result: IBackfillOfferingIdResult = {
    scanned: 0, written: 0, totals: emptyCounts(), byType: {}, bySpace: {}
  };

  const count = (type: string, spaceLabel: string, b: CountedBucket) => {
    result.totals[b] += 1;
    (result.byType[type] ??= emptyCounts())[b] += 1;
    (result.bySpace[spaceLabel] ??= emptyCounts())[b] += 1;
  };

  // Batched at Firestore's 400-write limit. `batch` stays undefined until there is something to write,
  // so a run with no work commits nothing at all. `written` counts only committed writes, so a run that
  // dies mid-flight cannot over-report what actually landed.
  const kBatchSize = 400;
  let batch: any;
  let queuedInBatch = 0;

  const commitBatch = async () => {
    await batch.commit();
    result.written += queuedInBatch;
    queuedInBatch = 0;
    batch = undefined;
  };

  const queueWrite = async (ref: any, offeringId: string) => {
    batch ??= (db as any).batch();
    batch.set(ref, { offeringId }, { merge: true });
    if (++queuedInBatch === kBatchSize) await commitBatch();
  };

  const report = () => {
    log(`scanned ${result.scanned}; ` +
        kAllBuckets.map((b) => `${b}: ${result.totals[b]}`).join(", "));
    // Said out loud because a Firestore equality query on `type` cannot return a document that has no
    // `type` field, so such documents are invisible to this census rather than counted as clean.
    log("documents with no `type` field are not reachable by these queries and are not counted");
    if (dryRun) log("DRY RUN — set APPLY=1 to write");
  };

  try {
    for (const type of types) {
      for await (const docs of iterateDocuments(db, type, pageSize)) {
        result.scanned += docs.length;
        const classified = docs.map((doc: any) => ({ doc, c: classifyDocument(doc.data(), doc.ref.path) }));

        for (const { c } of classified) {
          if (c.kind !== "counted") continue;
          count(type, c.spaceLabel, c.bucket);
        }

        const candidates = classified.filter((x) => x.c.kind === "lookup");
        // The lookups overlap, but each returns its resolution rather than writing. Writing from inside
        // concurrent callbacks would let one callback add to a batch another callback is already
        // committing, so the batch is fed sequentially from the results instead (see Task 4).
        const resolved = await mapInChunks(candidates, concurrency, async ({ doc, c }: any) => {
          try {
            const lookup = await getOfferingIdFromFirebaseMetadata(
              database, c.space.firebaseBasePath, c.contextId, c.uid, c.key
            );
            if (lookup.status !== "found") {
              // The two non-found statuses are named identically to their buckets, so they count themselves.
              count(type, c.space.label, lookup.status);
              return undefined;
            }
            count(type, c.space.label, "resolved");
            return { ref: doc.ref, offeringId: lookup.offeringId };
          } catch (error) {
            count(type, c.space.label, "lookupError");
            log(`lookup failed for ${doc.ref.path}: ${error}`);
            return undefined;
          }
        });

        // Fed sequentially, never from inside the concurrent callbacks above: `queueWrite` awaits a
        // commit and then clears `batch`, so a concurrent caller could otherwise add a write to a batch
        // that is already being committed.
        if (!dryRun) {
          for (const write of resolved) {
            if (write) await queueWrite(write.ref, write.offeringId);
          }
        }
      }
      // Emitted per type so a run that dies partway still shows how far it got. A re-run is safe but
      // starts over from the first type, so this is the only record of what a failed run covered.
      log(`finished ${type}: ${JSON.stringify(result.byType[type] ?? {})}`);
    }

    if (batch) await commitBatch();
  } finally {
    report();
  }

  return result;
}

async function main() {
  // Imported lazily so the Jest test can import backfillDocumentOfferingId without loading
  // firebase-admin or the import.meta-using script-utils module.
  const admin = (await import("firebase-admin")).default;
  const fs = (await import("fs")).default;
  const { getScriptRootFilePath } = await import("./lib/script-utils.js");
  const serviceAccountFile = getScriptRootFilePath("serviceAccountKey.json");
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountFile, "utf8"));
  // Looked up from the credential's project rather than hardcoded, because this script reads
  // offeringIds from the Realtime Database and writes them to Firestore. A URL naming a different
  // project than the credential would copy one environment's offerings onto another environment's
  // documents, and the census would report it as a clean success.
  //
  // Looked up rather than derived: the two projects do not share a host pattern, so a key whose
  // project is not listed here fails loudly instead of being pointed at a plausible guess. Keep in
  // step with the `databaseURL` values in src/lib/firebase-config.ts.
  const databaseURL = process.env.DATABASE_URL ?? {
    "collaborative-learning-ec215": "https://collaborative-learning-ec215.firebaseio.com",
    "collaborative-learning-staging": "https://collaborative-learning-staging-default-rtdb.firebaseio.com"
  }[serviceAccount.project_id as string];
  if (!databaseURL) {
    throw new Error(`No Realtime Database URL known for project "${serviceAccount.project_id}". ` +
      `Add it above, or set DATABASE_URL.`);
  }
  // Parsed before anything connects, so a bad value costs nothing.
  const types = parseTypes(process.env.TYPES);
  const pageSize = parsePageSize(process.env.PAGE_SIZE, 300);
  const dryRun = process.env.APPLY !== "1";
  console.log(`- Service account: ${serviceAccount.client_email}`);
  console.log(`- Firebase project: ${serviceAccount.project_id}`);
  console.log(`- Realtime Database URL: ${databaseURL}`);
  console.log(`- Types: ${types.join(", ")}`);
  console.log(`- Page size: ${pageSize}`);
  console.log(`- Mode: ${dryRun ? "DRY RUN" : "APPLY — will write"}`);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccountFile), databaseURL });
  const result = await backfillDocumentOfferingId(
    admin.firestore(), admin.database(), { dryRun, types, pageSize }
  );
  console.log("done", JSON.stringify(result, null, 2));
  process.exit(0);
}

// Run only when invoked directly (via tsx), never when imported by the Jest test.
if (!process.env.JEST_WORKER_ID) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
