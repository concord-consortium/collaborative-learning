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
// The `documents` collection-group queries need the single-field COLLECTION_GROUP index on `type` that
// is already declared in firestore.indexes.json.
//
// Dry run (reports counts, writes nothing):   npx tsx scripts/backfill-document-offering-id.ts
// Apply (performs the writes):                APPLY=1 npx tsx scripts/backfill-document-offering-id.ts

import type { Firestore } from "firebase-admin/firestore";

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

/** Every outcome a scanned document can be counted under. */
export type CountedBucket =
  | "resolved"
  | "alreadySet"
  | "noMetadataNode"
  | "nodeWithoutOfferingId"
  | "unusableDocument"
  | "unknownSpace"
  | "skippedClassWide"
  | "lookupError";

export type Classification =
  | { kind: "counted"; bucket: CountedBucket }
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
  // A generic axes document with no groupId is class-wide: class-unit-contained, correctly without an
  // offering. Writing one would corrupt the guard this script exists to make safe.
  if (isGenericAxesType(data?.type) && !data?.groupId) {
    return { kind: "counted", bucket: "skippedClassWide" };
  }
  if (data?.offeringId) return { kind: "counted", bucket: "alreadySet" };
  const space = getSpaceFromFirestorePath(docPath);
  if (!space) return { kind: "counted", bucket: "unknownSpace" };
  const contextId = data?.context_id;
  const uid = data?.uid;
  const key = data?.key;
  if (!contextId || !uid || !key) return { kind: "counted", bucket: "unusableDocument" };
  return { kind: "lookup", space, contextId, uid, key };
}
