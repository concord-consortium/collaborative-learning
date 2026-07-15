import firebase from "firebase/app";

export interface ICanonicalPointer {
  documentKey: string;
  createdAt: firebase.firestore.FieldValue | firebase.firestore.Timestamp;
  createdBy: string;
}

/**
 * Label for the pointer "slot" holding a scope's default canonical document. It is used two ways:
 * as the final segment of the pointer path (`.../canonical/<label>`) and as the value written to
 * the winning document's `canonical` field. It is a slot label, NOT the document's `type`: multiple
 * canonical documents of the same type can coexist in one scope, differentiated by their label.
 * firestore.rules reads the label from the document's `canonical` field, so it is not hardcoded there.
 */
export const kDefaultCanonicalDocumentLabel = "default";

/**
 * Path (relative to the Firestore root) of a canonical-document pointer for a CLUE group scope.
 * Each scope part is its own bare-id segment; `canonical` is the subcollection and `label` the
 * document id. 6 segments here + the 2-segment root = 8 (even).
 *
 * This is the group-scope member of a per-scope family of path builders: when another scope
 * (e.g. a class-scoped concurrent document) gains canonical documents, add a sibling builder
 * rather than parameterizing this one, and mirror it in firestore.rules `canonicalPointerPath`.
 */
export function getGroupCanonicalPointerPath(
  classHash: string, offeringId: string, groupId: string, label: string
): string {
  return `classes/${classHash}/offerings/${offeringId}/groups/${groupId}/canonical/${label}`;
}
