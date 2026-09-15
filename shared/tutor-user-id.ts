// The identity a tutor backend keys its cross-session memory on.
//
// Derived on the server from fields the Firestore rules pin to the caller's token, never read off
// the message: a field the rules only type-check is one a student can set to anything, and this
// value decides whose tutoring history a turn reads and writes.
//
// Under a portal launch that means context_id (pinned against class_hash) and uid (pinned against
// platform_user_id). The path's {portal} segment is deliberately not part of it: nothing in the
// rules ties that segment to the caller, so a learner can write a message under a different
// portal's root using their own uid, and an identity built from the path would resolve to a real
// student on that other portal. class_hash is a hash of the class, so it is globally unique and
// two students who share a platform user id stay distinct without needing the portal.
//
// The grain is therefore per (class, student) rather than per student: stable across every problem
// and unit within a class, and starting fresh if a student moves class. Nothing about a learner
// follows them across that boundary, which is a real limit on what a backend's memory can do — and
// also a reasonable default, since a year-old diagnosis of a misconception is as likely to be
// wrong as useful under a new teacher.
//
// Unauthenticated launches keep the partition CLUE roots their documents under — the demo name, or
// the firebase uid — because that partition is what distinguishes two of those users. There are no
// real student identities in a sandbox to protect, which is why its rules check shape and not
// ownership.
//
// Opaque rather than a portal URL. The partition arrives already escaped by escapeKey, which maps
// `.` `$` `[` `]` `#` `/` all to `_` and cannot be reversed, so a URL built from it would name a
// host that does not exist. ForeverLearning asks only for "an opaque, stable learner identifier,
// 1-255 characters".

export interface TutorUserIdArgs {
  /** The appMode segment of the trigger path: "authed" | "demo" | "qa" | "dev" | "test". */
  root: string;
  /** The partition segment: the escaped portal for authed, the demo name, or the firebase uid. */
  rootId: string;
  /** The platform user id, from the message field the rules pin to the caller's token. */
  uid: string;
  /** The class hash, from the message field the rules pin to the caller's class claim. */
  contextId: string;
}

/** The identity, or "" when there is not enough to identify anyone — the signal to refuse. */
export function tutorUserId({ root, rootId, uid, contextId }: TutorUserIdArgs): string {
  if (!root || !uid) return "";
  const id = encodeURIComponent(uid);
  if (root === "authed") {
    // No class means nothing pinned to anchor the identity to, and the portal segment cannot
    // stand in for it.
    return contextId ? `clue:class/${encodeURIComponent(contextId)}/users/${id}` : "";
  }
  if (!rootId) return "";
  return `clue:${encodeURIComponent(root)}/${encodeURIComponent(rootId)}/users/${id}`;
}
