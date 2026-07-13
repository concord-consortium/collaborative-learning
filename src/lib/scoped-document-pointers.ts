import firebase from "firebase/app";

export interface ICanonicalPointer {
  documentKey: string;
  createdAt: firebase.firestore.FieldValue | firebase.firestore.Timestamp;
  createdBy: string;
}

/**
 * Path (relative to the Firestore root) of the canonical-document pointer for a
 * CLUE group scope. Each scope part is its own bare-id segment; `canonical` is the
 * subcollection and `type` the document id. 6 segments here + the 2-segment root = 8 (even).
 */
export function getGroupCanonicalPointerPath(
  classHash: string, offeringId: string, groupId: string, type: string
): string {
  return `classes/${classHash}/offerings/${offeringId}/groups/${groupId}/canonical/${type}`;
}
