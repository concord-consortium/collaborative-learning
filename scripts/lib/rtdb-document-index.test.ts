import { buildRtdbDocumentIndex, isRtdbAddressable, resolveSpace } from "./rtdb-document-index";

describe("resolveSpace", () => {
  it("maps an authed portal to its RTDB root", () => {
    // The portal segment is already underscore-escaped in the Firestore path, so it is used as-is.
    expect(resolveSpace("authed/learn_concord_org/documents")).toEqual({
      status: "ok",
      label: "authed/learn_concord_org",
      rtdbRoot: "/authed/portals/learn_concord_org"
    });
  });

  it("maps a demo space to its RTDB root, which carries the literal 'demo' portal", () => {
    expect(resolveSpace("demo/CLUE-Test/documents")).toEqual({
      status: "ok",
      label: "demo/CLUE-Test",
      rtdbRoot: "/demo/CLUE-Test/portals/demo"
    });
  });

  it("keeps a portal segment containing a colon intact", () => {
    // authed/localhost:3000 is a real production space. Escaping happens at the URL layer, not here.
    expect(resolveSpace("authed/localhost:3000/documents")).toEqual({
      status: "ok",
      label: "authed/localhost:3000",
      rtdbRoot: "/authed/portals/localhost:3000"
    });
  });

  it("refuses qa and dev rather than treating them as ordinary spaces", () => {
    // delete-qa-user-data.ts purges the RTDB side of these partitions while leaving the Firestore
    // metadata behind. Every document there reads as damaged, so a repair run would try to create
    // thousands of rows for content that no longer exists. This has to be a refusal, not a default.
    for (const appMode of ["qa", "dev"]) {
      expect(resolveSpace(`${appMode}/someRootId/documents`)).toEqual({
        status: "refused",
        label: `${appMode}/someRootId`,
        reason: "qa and dev have had their realtime-database side purged; nothing there is repairable"
      });
    }
  });

  it("refuses test, whose RTDB portal segment is not derivable from the Firestore path", () => {
    expect(resolveSpace("test/someRootId/documents")).toEqual({
      status: "refused",
      label: "test/someRootId",
      reason: "the test partition's RTDB portal segment is arbitrary and not derivable"
    });
  });

  it("reports an unrecognized path shape instead of guessing at a root", () => {
    expect(resolveSpace("nosuchroot/whatever/documents")).toEqual({ status: "unrecognized" });
    expect(resolveSpace("authed//documents")).toEqual({ status: "unrecognized" });
    expect(resolveSpace("authed/learn_concord_org/other")).toEqual({ status: "unrecognized" });
    expect(resolveSpace("authed/learn_concord_org")).toEqual({ status: "unrecognized" });
  });
});

describe("isRtdbAddressable", () => {
  it("accepts ordinary push-id shaped segments", () => {
    expect(isRtdbAddressable("58de0784", "user-1", "-OXiK3RdodVskcYgwaAx")).toBe(true);
  });

  it("rejects any segment carrying a character the RTDB forbids in a path", () => {
    // Curriculum-authored supports carry human-readable keys like this one; production had two, and a
    // lookup on such a key throws rather than returning nothing.
    expect(isRtdbAddressable("c1", "curriculum", "2.2 Initial Challenge Support 1")).toBe(false);
    for (const bad of [".", "#", "$", "[", "]", "/"]) {
      expect(isRtdbAddressable("c1", "u1", `key${bad}x`)).toBe(false);
      expect(isRtdbAddressable(`ctx${bad}`, "u1", "k1")).toBe(false);
      expect(isRtdbAddressable("c1", `uid${bad}`, "k1")).toBe(false);
    }
  });

  it("rejects an empty segment, which would collapse the path", () => {
    expect(isRtdbAddressable("", "u1", "k1")).toBe(false);
    expect(isRtdbAddressable("c1", "", "k1")).toBe(false);
    expect(isRtdbAddressable("c1", "u1", "")).toBe(false);
  });
});

/**
 * A shallow reader backed by a plain object, mirroring what the RTDB REST API returns for
 * `?shallow=true`: the child keys of a node, or nothing when the node is absent.
 */
function readerFor(tree: Record<string, any>) {
  return async (path: string): Promise<string[]> => {
    const node = path.replace(/^\//, "").split("/")
      .reduce<any>((n, segment) => (n == null ? undefined : n[segment]), tree);
    return node ? Object.keys(node) : [];
  };
}

const kRoot = "/demo/Space/portals/demo";

function treeWith(classes: Record<string, Record<string, { documents?: string[], documentMetadata?: string[] }>>) {
  const asNode = (keys?: string[]) => Object.fromEntries((keys ?? []).map(k => [k, true]));
  return {
    demo: { Space: { portals: { demo: { classes: Object.fromEntries(
      Object.entries(classes).map(([classHash, users]) => [classHash, { users: Object.fromEntries(
        Object.entries(users).map(([uid, lists]) => [uid, {
          documents: asNode(lists.documents), documentMetadata: asNode(lists.documentMetadata)
        }])
      ) }])
    ) } } } }
  };
}

describe("buildRtdbDocumentIndex", () => {
  it("records a document present in both content and metadata", async () => {
    const tree = treeWith({ c1: { u1: { documents: ["k1"], documentMetadata: ["k1"] } } });
    const { index } = await buildRtdbDocumentIndex(kRoot, readerFor(tree));

    expect(index.get("k1")).toEqual({ classHash: "c1", uid: "u1", hasContent: true, hasMetadata: true });
  });

  it("records metadata with no content, which must never be given a Firestore row", async () => {
    // 86 such documents exist outside production. Minting metadata for them would promote an
    // invisible orphan into a Sort Work entry that throws when opened.
    const tree = treeWith({ c1: { u1: { documentMetadata: ["orphan"] } } });
    const { index } = await buildRtdbDocumentIndex(kRoot, readerFor(tree));

    expect(index.get("orphan")).toEqual({
      classHash: "c1", uid: "u1", hasContent: false, hasMetadata: true
    });
  });

  it("records content with no metadata, which indexing from metadata alone would miss entirely", async () => {
    const tree = treeWith({ c1: { u1: { documents: ["contentOnly"] } } });
    const { index } = await buildRtdbDocumentIndex(kRoot, readerFor(tree));

    expect(index.get("contentOnly")).toEqual({
      classHash: "c1", uid: "u1", hasContent: true, hasMetadata: false
    });
  });

  it("walks every class and user, counting what it covered", async () => {
    const tree = treeWith({
      c1: { u1: { documents: ["a"], documentMetadata: ["a"] }, u2: { documents: ["b"], documentMetadata: ["b"] } },
      c2: { u3: { documents: ["c"], documentMetadata: ["c"] } }
    });
    const { index, classes, userClassPairs } = await buildRtdbDocumentIndex(kRoot, readerFor(tree));

    expect(classes).toBe(2);
    expect(userClassPairs).toBe(3);
    expect([...index.keys()].sort()).toEqual(["a", "b", "c"]);
  });

  it("reports a key that appears under two homes instead of silently picking one", async () => {
    // All 116,000 production keys were distinct, but that is a finding about one space. A key with
    // two homes makes "the class this document lives in" ambiguous, so the repair must not guess.
    const tree = treeWith({
      c1: { u1: { documents: ["shared"], documentMetadata: ["shared"] } },
      c2: { u2: { documents: ["shared"], documentMetadata: ["shared"] } }
    });
    const { duplicates } = await buildRtdbDocumentIndex(kRoot, readerFor(tree));

    expect(duplicates).toEqual([{ key: "shared", homes: ["c1/u1", "c2/u2"] }]);
  });

  it("returns an empty index for a space with no classes", async () => {
    const { index, classes, duplicates } = await buildRtdbDocumentIndex(kRoot, readerFor({}));

    expect(index.size).toBe(0);
    expect(classes).toBe(0);
    expect(duplicates).toEqual([]);
  });
});
