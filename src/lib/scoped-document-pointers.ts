import firebase from "firebase/app";

export interface ICanonicalPointer {
  documentKey: string;
  createdAt: firebase.firestore.FieldValue | firebase.firestore.Timestamp;
  createdBy: string;
}

/**
 * Label for the pointer "slot" holding a scope's default canonical document. It is used two ways:
 * as the final segment of the pointer path (`.../slots/<label>`) and as the value written to
 * the winning document's `canonical` field. It is a slot label, NOT the document's `type`: multiple
 * canonical documents of the same type can coexist in one scope, differentiated by their label.
 * firestore.rules reads the label from the document's `canonical` field, so it is not hardcoded there.
 */
export const kDefaultCanonicalDocumentLabel = "default";

export interface ICanonicalPointerScope {
  classHash: string;
  offeringId?: string;
  groupId?: string;
  unit?: string;
  // owner?: string;  // future: problem/planning pointers are scoped to an offering + a user (users/<owner>).
}

/**
 * Path (relative to the Firestore root) of a canonical-document pointer. Pointers live in a dedicated,
 * versioned collection — `canonical/v1/…` — rather than interleaved in the class/offering/group document
 * tree. That keeps their access rules stated per concern (uniform read + immutability across scopes, create
 * per-scope) and leaves room to introduce a different layout under a later version prefix. Below the version,
 * the path is built segment-by-segment from the scope fields the document carries, so every scope shares one
 * layout:
 *
 *   canonical/v1/classes/<classHash> / (offerings/<offeringId> | units/<unit>) / [groups/<groupId>] / slots/<label>
 *
 * The `units/` segment is used only when there is no offering — an offering already pins a unit, so
 * offering-scoped pointers (group docs; future problem/planning docs) omit it, while class+unit pointers
 * (class-wide docs like the DQB) use it. For class-wide slots the label equals the document's `kind`; the
 * group document keeps its CLUE-524 label `default`.
 *
 * firestore.rules `canonicalPointerPath` builds the same path the same way (string concat + path(), verified
 * against the emulator) — keep the two in lockstep.
 */
export function getCanonicalPointerPath(scope: ICanonicalPointerScope, label: string): string {
  const { classHash, offeringId, groupId, unit } = scope;
  const segments = [`canonical/v1/classes/${classHash}`];
  if (offeringId) {
    segments.push(`offerings/${offeringId}`);
  } else if (unit) {
    segments.push(`units/${unit}`);
  }
  if (groupId) {
    segments.push(`groups/${groupId}`);
  }
  segments.push(`slots/${label}`);
  return segments.join("/");
}

