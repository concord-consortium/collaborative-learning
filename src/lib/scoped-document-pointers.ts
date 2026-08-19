import firebase from "firebase/app";

export interface ICanonicalPointer {
  documentKey: string;
  createdAt: firebase.firestore.FieldValue | firebase.firestore.Timestamp;
  createdBy: string;
}

/**
 * Label for the pointer "slot" holding a container's default canonical document. It is used two ways:
 * as the final segment of the pointer path (`.../slots/<label>`) and as the value written to
 * the winning document's `canonical` field. It is a slot label, NOT the document's `type`: multiple
 * canonical documents of the same type can coexist in one container, differentiated by their label.
 * firestore.rules reads the label from the document's `canonical` field, so it is not hardcoded there.
 */
export const kDefaultCanonicalDocumentLabel = "default";

/**
 * A canonical slot: a container, an owner, and a label (see docs/document-axes/axes.md). Exactly one
 * document fills a slot, and `getCanonicalPointerPath` turns the slot into the path of the pointer
 * that names it.
 *
 * The container is given as the class plus, when the document is kept below the class, that
 * container's own id — an `offeringId` or a `unit`. The owner is the document's `uid`, including the
 * synthetic owners (`group_<offeringId>_<groupId>`, `class_<classHash>`).
 */
export interface ICanonicalSlot {
  classHash: string;
  offeringId?: string;
  unit?: string;
  owner: string;
  label: string;
}

/**
 * Path (relative to the Firestore root) of a canonical-document pointer. Pointers live in a dedicated,
 * versioned collection — `canonical/v1/…` — rather than interleaved in the class/offering document tree.
 * That keeps their access rules stated per concern (uniform read + immutability across containers, create
 * per container shape) and leaves room to introduce a different layout under a later version prefix.
 * Below the version:
 *
 *   canonical/v1/classes/<classHash> / [offerings/<offeringId> | units/<unit>] / owners/<uid> / slots/<label>
 *
 * The class leads because the rules authorize reads by comparing that segment to the caller's class
 * claim, which a synthetic group owner id cannot supply. Below it the container contributes its **own**
 * level and id rather than a chain of ancestors: an offering names only itself, even though every
 * offering falls inside a classUnit. Pointers are immutable (firestore.rules grants no update or
 * delete), so a pointer cannot be moved — addressing each one by its own container is what lets a new
 * container level be introduced later without stranding the pointers that already exist. A document
 * kept by the class alone would omit the level entirely; nothing creates one yet, and the rules grant
 * no create for that shape (see firestore.rules).
 *
 * firestore.rules `canonicalPointerPath` builds the same path the same way (string concat + path(),
 * verified against the emulator) — keep the two in lockstep.
 */
export function getCanonicalPointerPath(slot: ICanonicalSlot): string {
  const { classHash, offeringId, unit, owner, label } = slot;
  const segments = [`canonical/v1/classes/${classHash}`];
  if (offeringId) {
    segments.push(`offerings/${offeringId}`);
  } else if (unit) {
    segments.push(`units/${unit}`);
  }
  segments.push(`owners/${owner}`);
  segments.push(`slots/${label}`);
  return segments.join("/");
}
