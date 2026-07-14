import firebase from "firebase/app";

export interface ICanonicalPointer {
  documentKey: string;
  createdAt: firebase.firestore.FieldValue | firebase.firestore.Timestamp;
  createdBy: string;
}

/**
 * Label for the pointer "slot" holding a scope's default canonical document. This is the final
 * segment of the pointer path (`.../canonical/<label>`). It is a slot label, NOT the document's
 * `type`: multiple canonical documents of the same type can coexist in one scope, differentiated
 * by their label. This value must match the literal used in firestore.rules `canonicalFieldOk()`.
 */
export const kDefaultCanonicalDocumentLabel = "default";

/**
 * Path (relative to the Firestore root) of a canonical-document pointer for a CLUE group scope.
 * Each scope part is its own bare-id segment; `canonical` is the subcollection and `label` the
 * document id. 6 segments here + the 2-segment root = 8 (even).
 */
export function getGroupCanonicalPointerPath(
  classHash: string, offeringId: string, groupId: string, label: string
): string {
  return `classes/${classHash}/offerings/${offeringId}/groups/${groupId}/canonical/${label}`;
}
