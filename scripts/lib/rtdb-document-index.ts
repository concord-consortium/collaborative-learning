// Shared by the CLUE-643 repair scripts: resolve a Firestore space to its realtime-database root,
// and index a space's documents from the realtime database.

const kRtdbIllegal = /[.#$[\]/]/;

/**
 * Whether a document can be addressed in the realtime database at all.
 *
 * A path segment containing any of `.#$[]/` is rejected by the RTDB, so a lookup built from one throws
 * rather than returning nothing. Curriculum-authored supports use their caption as a key, which
 * contains dots. An empty segment is rejected too, since it would collapse the path onto its parent.
 */
export function isRtdbAddressable(classHash: string, uid: string, key: string): boolean {
  return [classHash, uid, key].every(segment => !!segment && !kRtdbIllegal.test(segment));
}

/**
 * Where a Firestore space's documents live in the realtime database, or why they cannot be reached.
 *
 * `refused` is deliberately distinct from `unrecognized`: a caller must be able to report "this space
 * exists and we are choosing not to touch it" separately from "this path shape is not one we know".
 */
export type SpaceResolution =
  | { status: "ok"; label: string; rtdbRoot: string }
  | { status: "refused"; label: string; reason: string }
  | { status: "unrecognized" };

const kRefusals: Record<string, string> = {
  qa: "qa and dev have had their realtime-database side purged; nothing there is repairable",
  dev: "qa and dev have had their realtime-database side purged; nothing there is repairable",
  test: "the test partition's RTDB portal segment is arbitrary and not derivable"
};

/**
 * Map a Firestore documents-collection path (`<appMode>/<space>/documents`) to the realtime-database
 * root holding the same space's classes.
 *
 * The portal segment appears in the RTDB path but not the Firestore one, so it cannot be derived in
 * general — only for the app modes below, where it is fixed or already present in the space name.
 */
export function resolveSpace(firestoreSpacePath: string): SpaceResolution {
  const segments = firestoreSpacePath.split("/");
  if (segments.length !== 3) return { status: "unrecognized" };

  const [appMode, space, collection] = segments;
  if (!appMode || !space || collection !== "documents") return { status: "unrecognized" };

  const label = `${appMode}/${space}`;
  const refusal = kRefusals[appMode];
  if (refusal) return { status: "refused", label, reason: refusal };

  // The Firestore portal segment is already underscore-escaped, so it transfers unchanged.
  if (appMode === "authed") return { status: "ok", label, rtdbRoot: `/authed/portals/${space}` };
  // Every demo space sits under the literal portal "demo".
  if (appMode === "demo") return { status: "ok", label, rtdbRoot: `/demo/${space}/portals/demo` };

  return { status: "unrecognized" };
}

/** Reads the child keys of one realtime-database node, or an empty list when the node is absent. */
export type ReadChildKeys = (path: string) => Promise<string[]>;

/** Where one document lives, and which of its two realtime-database halves are present. */
export interface IDocumentHome {
  classHash: string;
  uid: string;
  hasContent: boolean;
  hasMetadata: boolean;
}

export interface IRtdbDocumentIndex {
  index: Map<string, IDocumentHome>;
  /** Keys found under more than one home. The repair must report these, never choose between them. */
  duplicates: Array<{ key: string; homes: string[] }>;
  classes: number;
  userClassPairs: number;
}

/** Runs `fn` over `items` with at most `limit` in flight, preserving nothing but completion. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i]);
    }
  }));
}

/**
 * Index every document in one space by walking `classes` → `users` and reading both child lists.
 *
 * Reading `documents` as well as `documentMetadata` is what lets a caller tell a document whose
 * content still exists from one whose does not. An index built from `documentMetadata` alone cannot
 * see the difference, and cannot see content-only documents at all.
 */
export async function buildRtdbDocumentIndex(
  rtdbRoot: string,
  readChildKeys: ReadChildKeys,
  { concurrency = 40 }: { concurrency?: number } = {}
): Promise<IRtdbDocumentIndex> {
  const index = new Map<string, IDocumentHome>();
  const duplicates: Array<{ key: string; homes: string[] }> = [];

  const classes = await readChildKeys(`${rtdbRoot}/classes`);

  const pairs: Array<{ classHash: string; uid: string }> = [];
  await pool(classes, concurrency, async (classHash) => {
    for (const uid of await readChildKeys(`${rtdbRoot}/classes/${classHash}/users`)) {
      pairs.push({ classHash, uid });
    }
  });

  const record = (key: string, classHash: string, uid: string, half: "hasContent" | "hasMetadata") => {
    const existing = index.get(key);
    if (!existing) {
      index.set(key, { classHash, uid, hasContent: false, hasMetadata: false, [half]: true });
      return;
    }
    if (existing.classHash !== classHash || existing.uid !== uid) {
      const homes = [`${existing.classHash}/${existing.uid}`, `${classHash}/${uid}`];
      // One duplicate entry per offending home pair, however many halves disagree.
      if (!duplicates.some(d => d.key === key && d.homes[1] === homes[1])) duplicates.push({ key, homes });
      return;
    }
    existing[half] = true;
  };

  await pool(pairs, concurrency, async ({ classHash, uid }) => {
    const userPath = `${rtdbRoot}/classes/${classHash}/users/${uid}`;
    const [content, metadata] = await Promise.all([
      readChildKeys(`${userPath}/documents`),
      readChildKeys(`${userPath}/documentMetadata`)
    ]);
    for (const key of content) record(key, classHash, uid, "hasContent");
    for (const key of metadata) record(key, classHash, uid, "hasMetadata");
  });

  return { index, duplicates, classes: classes.length, userClassPairs: pairs.length };
}
