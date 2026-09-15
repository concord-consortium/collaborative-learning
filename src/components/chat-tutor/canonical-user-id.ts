// The identity a tutor backend keys its memory on.
//
// NOT user.id. That is the portal's platform user id — "101" — and platform user ids are
// per-portal sequences, so the same one names different people on different portals. CLUE never
// relies on it alone: every path is rooted under a partition (/authed/{portal}/…, /demo/{name}/…),
// so CLUE's real identity is (partition, id). A backend keying memory on the bare id has a flat
// namespace and would merge two students into one, with one student's history informing the
// other's tutoring. Nothing errors when that happens, which is what makes it worth care here.
//
// For a portal launch the platform already publishes a canonical form —
// `https://learn.concord.org/users/101`, carried on the JWT as `user_id` (see
// PortalFirebaseJWTBaseClaims in lib/portal-types.ts). Passing the platform's own string through,
// rather than inventing a scheme of our own, means anyone correlating a backend's records against
// portal records later needs no translation table.
//
// Unauthed launches have no portal, so they get an address in a namespace we own. It carries the
// same partition CLUE roots documents under — the demo name, or the firebase user id — because
// that partition is exactly what distinguishes two users who share a platform id. Without it,
// student 1 of one demo class and student 1 of another are one person.

export interface CanonicalUserIdArgs {
  /** "authed" for a portal launch; "demo" | "qa" | "dev" | "test" otherwise. */
  appMode: string;
  /** The platform user id — user.id. */
  userId: string;
  /** The partition CLUE roots documents under — getRootId(). Escaped portal, demo name, or uid. */
  rootId: string;
  /** The portal host, without scheme — user.portal. Absent outside an authed launch. */
  portalHost?: string;
  /** The portal's own canonical user url, from the JWT. Absent outside an authed launch. */
  portalUserUrl?: string;
}

// Not a real portal, and a domain we own, so an invented address can never be mistaken for a
// portal's and can never collide with one.
const kUnauthedPortal = "clue.concord.org";

export function canonicalUserId(args: CanonicalUserIdArgs): string {
  const { appMode, userId, rootId, portalHost, portalUserUrl } = args;
  // Passed through verbatim when present: it is the platform's identifier, not ours to normalize.
  if (portalUserUrl) return portalUserUrl;
  // An authed launch whose JWT lacked the field still has a real portal. Reconstructing from the
  // host keeps that student out of the invented namespace below.
  if (appMode === "authed" && portalHost) {
    return `https://${portalHost}/users/${userId}`;
  }
  // A path segment rather than a subdomain: a demo name is author-supplied and need not be
  // hostname-safe, and encoding a segment is lossless where flattening a host is not.
  const partition = rootId ? `/${encodeURIComponent(rootId)}` : "";
  return `https://${appMode}.${kUnauthedPortal}${partition}/users/${userId}`;
}
