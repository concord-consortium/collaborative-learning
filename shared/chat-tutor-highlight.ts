// Shape the tutor's reply writes onto an assistant message and the client reads back. Defined in
// shared/ because it is a wire contract between the server (functions-v2) and client packages.
export interface TutorHighlight {
  tileId: string;
  objectId: string;
  label: string;
}

/**
 * Whether a value is a fully formed highlight: three fields, each a non-empty string.
 *
 * Both sides of the wire apply this — the server before writing an assistant message, the client
 * before building a turn from one — so it lives beside the interface it validates. Two copies would
 * let one side widen or narrow without the other, and the resulting mismatch is silent: an entry one
 * side considers valid simply does not become a button on the other.
 *
 * Empty strings are rejected, not just missing fields. An empty id resolves to nothing and an empty
 * label renders a button with no words on it; a button that cannot resolve is worse than no button.
 */
export function isTutorHighlight(value: unknown): value is TutorHighlight {
  const h = value as Record<string, unknown> | null | undefined;
  return !!h && typeof h.tileId === "string" && h.tileId.length > 0 &&
    typeof h.objectId === "string" && h.objectId.length > 0 &&
    typeof h.label === "string" && h.label.length > 0;
}
