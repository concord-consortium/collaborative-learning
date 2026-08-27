// Reads the `offeringId` that the Realtime Database stores alongside a document's basic metadata:
//
//   <firebaseBasePath>/<contextId>/users/<userId>/documentMetadata/<key>
//
// For a document whose Firestore metadata has no `offeringId`, this node is the only place the
// offering can be recovered from without scanning the offering tree.
//
// The database handle and base path are arguments rather than module state so this can be unit tested
// and shared. This module deliberately uses no `import.meta` (unlike lib/script-utils.ts) and imports
// firebase-admin not at all, so Jest can load it.

/** The subset of the firebase-admin Database this module uses. */
export interface IMetadataDatabase {
  ref(path: string): {
    once(eventType: "value"): Promise<{ exists(): boolean; val(): any }>;
  };
}

/**
 * The outcome of a lookup. The two failures are distinguished because they have different causes: a
 * missing node means the metadata tree was never written for this document, while a node without the
 * field means it was written without an offering.
 */
export type OfferingIdLookup =
  | { status: "found"; offeringId: string }
  | { status: "noMetadataNode" }
  | { status: "nodeWithoutOfferingId" };

/** The path the app writes basic document metadata to, for every document type. */
export function getUserDocumentMetadataPath(
  firebaseBasePath: string, contextId: string, userId: string, key: string
): string {
  return `${firebaseBasePath}/${contextId}/users/${userId}/documentMetadata/${key}`;
}

/**
 * Read a document's stored `offeringId`. Rejects if the read fails: a transport error is not evidence
 * that the document has no offering, and callers that conflate the two would write off recoverable
 * documents. Each caller decides what to do with the rejection.
 */
export async function getOfferingIdFromFirebaseMetadata(
  database: IMetadataDatabase,
  firebaseBasePath: string,
  contextId: string,
  userId: string,
  key: string
): Promise<OfferingIdLookup> {
  const path = getUserDocumentMetadataPath(firebaseBasePath, contextId, userId, key);
  const snapshot = await database.ref(path).once("value");
  const value = snapshot.exists() ? snapshot.val() : undefined;
  if (!value) return { status: "noMetadataNode" };
  // An unresolved offering is stored as "", which must not be written back as if it were an offering.
  // Required to be a string: the app compares this field against a string in Firestore queries, so a
  // number written back here would leave the document looking repaired but matching nothing.
  const offeringId = value.offeringId;
  if (!offeringId || typeof offeringId !== "string") return { status: "nodeWithoutOfferingId" };
  return { status: "found", offeringId };
}
