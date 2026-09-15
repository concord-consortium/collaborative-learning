// The identity a tutor backend keys its cross-session memory on.
//
// DERIVED ON THE SERVER, never read off the message. An earlier version of this took a
// client-supplied field that the Firestore rules only type-checked as a string — which made a
// student's tutoring memory addressable by any classmate who wrote a different value. The rules
// pin `uid` to the caller's token and the trigger path supplies the partition, so building the
// identity from those two is unforgeable by construction rather than by a check someone has to
// remember to write.
//
// NOT the bare platform user id. That is a per-portal sequence, so the same value names different
// people on different portals, and a backend with a flat namespace would merge two students into
// one — with one student's history informing the other's tutoring, silently. CLUE never relies on
// it alone either: every path is rooted under a partition (/authed/{portal}/…, /demo/{name}/…),
// which is exactly what distinguishes two users who share a platform id.
//
// Opaque rather than a portal URL. The partition reaches us already escaped by escapeKey, which
// maps `.` `$` `[` `]` `#` `/` all to `_` and cannot be reversed, so a URL built from it would be
// a host that does not exist. ForeverLearning asks only for "an opaque, stable learner
// identifier, 1-255 characters"; claiming a canonical portal address we cannot actually
// reconstruct would be worse than not claiming one.

export interface TutorUserIdArgs {
  /** The appMode segment of the trigger path: "authed" | "demo" | "qa" | "dev" | "test". */
  root: string;
  /** The partition segment: the escaped portal for authed, the demo name, or the firebase uid. */
  rootId: string;
  /** The platform user id, from the message field the rules pin to the caller's token. */
  uid: string;
}

/** The identity, or "" when there is not enough to identify anyone — the signal to refuse. */
export function tutorUserId({ root, rootId, uid }: TutorUserIdArgs): string {
  if (!root || !rootId || !uid) return "";
  return `clue:${encodeURIComponent(root)}/${encodeURIComponent(rootId)}/users/${encodeURIComponent(uid)}`;
}
