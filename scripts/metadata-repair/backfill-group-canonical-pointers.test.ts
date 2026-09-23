import { getCanonicalPointerPath, kDefaultCanonicalDocumentLabel } from "../../src/lib/scoped-document-pointers";
import { getGroupOwnerId } from "../../src/models/document/document-axes";
import {
  backfillSpace, createSpaceDeps, decideSlot, groupIntoSlots, groupOwnerId, groupPointerRelativePath,
  kGroupPointerLabel, kPointerCreatedBy, legacyGroupPointerRelativePaths, listGroupDocs, whyNotDeletable,
  type IDeletionTarget, type IGroupDocRecord, type ISpaceDeps
} from "./backfill-group-canonical-pointers";

const space = { label: "authed/p", spacePath: "authed/p/documents", rtdbRoot: "/authed/portals/p" };

// A well-formed group document for group "3" of offering "o1" in class "c1".
const mkDoc = (key: string, fields: Partial<IGroupDocRecord> = {}): IGroupDocRecord => ({
  key, contextId: "c1", offeringId: "o1", groupId: "3", uid: "group_o1_3", ...fields
});

const slotPointerPath = "authed/p/canonical/v1/classes/c1/offerings/o1/owners/group_o1_3/slots/default";
const legacyPointerPaths = [
  "authed/p/classes/c1/offerings/o1/groups/3/canonical/default",
  "authed/p/canonical/v1/classes/c1/offerings/o1/groups/3/slots/default"
];
const readLegacy = legacyPointerPaths.map(p => `read ${p}`);

/**
 * Deps that record every call in one ordered log, so a test can assert both what happened and in which
 * order — the backup-before-delete guarantee is an ordering property.
 */
function makeDeps(docs: IGroupDocRecord[], pointers: Record<string, unknown> = {},
  { claimResult }: { claimResult?: unknown } = {}) {
  const calls: string[] = [];
  const deps: ISpaceDeps = {
    listGroupDocs: async () => { calls.push("list"); return docs; },
    readPointer: async (path) => {
      calls.push(`read ${path}`);
      return path in pointers ? { documentKey: pointers[path] } : undefined;
    },
    claim: async (path, key) => {
      calls.push(`claim ${path} ${key}`);
      return { documentKey: claimResult !== undefined ? claimResult : key };
    },
    backup: async (t: IDeletionTarget) => { calls.push(`backup ${t.key}`); },
    remove: async (t: IDeletionTarget) => { calls.push(`remove ${t.key}`); },
    removeLegacyPointer: async (path) => { calls.push(`remove pointer ${path}`); },
    log: () => undefined
  };
  return { deps, calls };
}

describe("formulas kept in step with src", () => {
  // Scripts cannot import from src, so the script repeats these. A rename or reformat on either side
  // would silently point every claim at a slot the app never reads.
  it("builds the same group owner uid as the app", () => {
    expect(groupOwnerId("o1", "3")).toBe(getGroupOwnerId("o1", "3"));
  });

  it("builds the same pointer path as the app", () => {
    expect(kGroupPointerLabel).toBe(kDefaultCanonicalDocumentLabel);
    expect(groupPointerRelativePath({ contextId: "c1", offeringId: "o1", uid: "group_o1_3" }))
      .toBe(getCanonicalPointerPath({
        classHash: "c1", offeringId: "o1", owner: "group_o1_3", label: kDefaultCanonicalDocumentLabel
      }));
  });

  it("builds the 7.3.0 and 7.4.0 pointer paths", () => {
    expect(legacyGroupPointerRelativePaths({ contextId: "c1", offeringId: "o1", groupId: "3" }))
      .toEqual(legacyPointerPaths.map(p => p.replace(/^authed\/p\//, "")));
  });
});

describe("listGroupDocs", () => {
  // Records the query so the test pins its predicate, not just the mocked result.
  function makeFirestore(docs: Array<{ id: string; data: Record<string, any> }>) {
    const calls: { collection?: string; where?: [string, string, any] } = {};
    const firestore = {
      collection: (path: string) => {
        calls.collection = path;
        return {
          where: (field: string, op: string, value: any) => {
            calls.where = [field, op, value];
            return { get: async () => ({
              docs: docs.map(d => ({ id: d.id, get: (name: string) => d.data[name] }))
            }) };
          }
        };
      }
    };
    return { firestore, calls };
  }

  it("matches both the pre-rename and the current generic type", async () => {
    // A group document still storing "group" is one the axes backfill has not reached. Leaving it out
    // would leave its slot without a pointer, and removing findLegacy would then strand its work.
    const { firestore, calls } = makeFirestore([]);
    await listGroupDocs(firestore, "authed/p/documents");
    expect(calls.collection).toBe("authed/p/documents");
    expect(calls.where).toEqual(["type", "in", ["group", "axes"]]);
  });

  it("keeps only group-scoped documents and reads the fields a slot is built from", async () => {
    const { firestore } = makeFirestore([
      { id: "g", data: { type: "group", context_id: "c1", offeringId: "o1", groupId: "3", uid: "group_o1_3" } },
      { id: "cw", data: { type: "axes", context_id: "c1", unit: "u", uid: "class_c1" } }
    ]);
    expect(await listGroupDocs(firestore, "authed/p/documents")).toEqual([{
      key: "g", contextId: "c1", offeringId: "o1", groupId: "3", uid: "group_o1_3"
    }]);
  });
});

describe("groupIntoSlots", () => {
  it("groups documents by class, offering and group, each slot sorted by key", () => {
    const { slots, skipped } = groupIntoSlots([
      mkDoc("b"), mkDoc("a"), mkDoc("x", { groupId: "4", uid: "group_o1_4" })
    ]);
    expect(skipped).toEqual([]);
    expect(slots.map(s => [s.groupId, s.docs.map(d => d.key)])).toEqual([["3", ["a", "b"]], ["4", ["x"]]]);
  });

  it("orders keys the way Firestore does, by code unit rather than by locale", () => {
    // Push ids mix cases and punctuation; a locale-aware sort would pick a different winner than
    // findLegacy's unordered query, which returns documents in id order.
    const { slots } = groupIntoSlots([mkDoc("a"), mkDoc("B"), mkDoc("-")]);
    expect(slots[0].docs.map(d => d.key)).toEqual(["-", "B", "a"]);
  });

  it("skips a document missing any field its slot is built from", () => {
    const { slots, skipped } = groupIntoSlots([
      mkDoc("a", { contextId: undefined }), mkDoc("b", { offeringId: undefined }), mkDoc("c", { groupId: "" })
    ]);
    expect(slots).toEqual([]);
    expect(skipped.map(s => s.key)).toEqual(["a", "b", "c"]);
  });

  it("skips the whole slot when any of its documents has the wrong owner uid", () => {
    // Skipping only the bad document could change which document wins, diverging from findLegacy.
    const { slots, skipped } = groupIntoSlots([mkDoc("a"), mkDoc("b", { uid: "student1" })]);
    expect(slots).toEqual([]);
    expect(skipped.map(s => s.key)).toEqual(["a", "b"]);
    expect(skipped[1].reason).toMatch(/uid/);
  });

  it("skips the whole slot when any of its documents cannot be addressed in the realtime database", () => {
    const { slots, skipped } = groupIntoSlots([mkDoc("a"), mkDoc("b.c")]);
    expect(slots).toEqual([]);
    expect(skipped.map(s => s.key)).toEqual(["a", "b.c"]);
  });
});

describe("decideSlot", () => {
  const slot = (docs: IGroupDocRecord[]) => groupIntoSlots(docs).slots[0];

  it("claims the lowest key when the slot has no pointer, and deletes the rest", () => {
    const d = decideSlot(slot([mkDoc("b"), mkDoc("a"), mkDoc("c")]), undefined);
    expect(d).toMatchObject({ action: "claim", winner: "a" });
    expect(d.action !== "dangling" && d.losers.map(l => l.key)).toEqual(["b", "c"]);
  });

  it("keeps the pointer's document when the slot already has one, and deletes the rest", () => {
    const d = decideSlot(slot([mkDoc("a"), mkDoc("b")]), { documentKey: "b" });
    expect(d).toMatchObject({ action: "pointed", winner: "b", losers: [{ key: "a" }] });
  });

  it("touches nothing when the pointer names a document not in the slot", () => {
    expect(decideSlot(slot([mkDoc("a"), mkDoc("b")]), { documentKey: "zzz" }))
      .toEqual({ action: "dangling", pointerKey: "zzz" });
  });

  it.each([undefined, null, "", 42])("touches nothing when the pointer's documentKey is %p", (documentKey) => {
    expect(decideSlot(slot([mkDoc("a"), mkDoc("b")]), { documentKey })).toEqual({ action: "invalid" });
  });
});

describe("backfillSpace", () => {
  it("dry run reads pointers but claims, backs up and removes nothing", async () => {
    const { deps, calls } = makeDeps([mkDoc("a"), mkDoc("b")], { [legacyPointerPaths[0]]: "a" });
    const res = await backfillSpace(space, { dryRun: true }, deps);
    expect(calls).toEqual(["list", `read ${slotPointerPath}`, ...readLegacy]);
    expect(res).toMatchObject({ slots: 1, alreadyPointed: 0, claimed: 1, deleted: 1, legacyPointersDeleted: 1 });
  });

  it("claims, then backs up each loser before removing it", async () => {
    const { deps, calls } = makeDeps([mkDoc("a"), mkDoc("b"), mkDoc("c")]);
    const res = await backfillSpace(space, { dryRun: false }, deps);
    expect(calls).toEqual([
      "list", `read ${slotPointerPath}`, `claim ${slotPointerPath} a`,
      "backup b", "remove b", "backup c", "remove c", ...readLegacy
    ]);
    expect(res).toMatchObject({ slots: 1, alreadyPointed: 0, claimed: 1, deleted: 2 });
  });

  it("deletes duplicates in a slot that already has a pointer, without claiming", async () => {
    const { deps, calls } = makeDeps([mkDoc("a"), mkDoc("b")], { [slotPointerPath]: "b" });
    const res = await backfillSpace(space, { dryRun: false }, deps);
    expect(calls).toEqual(["list", `read ${slotPointerPath}`, "backup a", "remove a", ...readLegacy]);
    expect(res).toMatchObject({ alreadyPointed: 1, claimed: 0, deleted: 1 });
  });

  it("deletes every 7.3.0 and 7.4.0 pointer in the slot, whichever document it names", async () => {
    // 7.3.0 claimed the winner, 7.4.0 a loser. Only the pointer at the current path should remain.
    const { deps, calls } = makeDeps([mkDoc("a"), mkDoc("b")],
      { [slotPointerPath]: "a", [legacyPointerPaths[0]]: "a", [legacyPointerPaths[1]]: "b" });
    const res = await backfillSpace(space, { dryRun: false }, deps);
    expect(calls).toEqual([
      "list", `read ${slotPointerPath}`, "backup b", "remove b",
      readLegacy[0], `remove pointer ${legacyPointerPaths[0]}`,
      readLegacy[1], `remove pointer ${legacyPointerPaths[1]}`
    ]);
    expect(res).toMatchObject({ deleted: 1, legacyPointersDeleted: 2, skipped: [] });
  });

  it("deletes legacy pointers in a slot with a single document", async () => {
    const { deps, calls } = makeDeps([mkDoc("a")], { [slotPointerPath]: "a", [legacyPointerPaths[1]]: "a" });
    const res = await backfillSpace(space, { dryRun: false }, deps);
    expect(calls).toEqual([
      "list", `read ${slotPointerPath}`, ...readLegacy, `remove pointer ${legacyPointerPaths[1]}`
    ]);
    expect(res).toMatchObject({ alreadyPointed: 1, deleted: 0, legacyPointersDeleted: 1 });
  });

  it("converges on the document a client claimed mid-run instead of deleting it", async () => {
    // Between the read and the claim a student opened the group document and findLegacy claimed "b".
    const { deps, calls } = makeDeps([mkDoc("a"), mkDoc("b")], {}, { claimResult: "b" });
    const res = await backfillSpace(space, { dryRun: false }, deps);
    expect(calls).toEqual([
      "list", `read ${slotPointerPath}`, `claim ${slotPointerPath} a`, "backup a", "remove a", ...readLegacy
    ]);
    expect(res).toMatchObject({ claimed: 0, alreadyPointed: 1, deleted: 1 });
  });

  it("touches nothing more when a mid-run claim names a document outside the slot", async () => {
    const { deps, calls } = makeDeps([mkDoc("a"), mkDoc("b")], { [legacyPointerPaths[0]]: "a" },
      { claimResult: "zzz" });
    const res = await backfillSpace(space, { dryRun: false }, deps);
    expect(calls).toEqual(["list", `read ${slotPointerPath}`, `claim ${slotPointerPath} a`]);
    expect(res).toMatchObject({ deleted: 0, legacyPointersDeleted: 0 });
    expect(res.skipped).toEqual([{ key: "zzz", reason: expect.stringMatching(/not in the slot/) }]);
  });

  it("skips the whole slot, claiming and deleting nothing, when its pointer has no documentKey", async () => {
    const { deps, calls } = makeDeps([mkDoc("a"), mkDoc("b")],
      { [slotPointerPath]: undefined, [legacyPointerPaths[0]]: "a" });
    const res = await backfillSpace(space, { dryRun: false }, deps);
    expect(calls).toEqual(["list", `read ${slotPointerPath}`]);
    expect(res).toMatchObject({ claimed: 0, alreadyPointed: 0, deleted: 0, legacyPointersDeleted: 0 });
    expect(res.skipped).toEqual([
      { key: "a", reason: expect.stringMatching(/no document key/) },
      { key: "b", reason: expect.stringMatching(/no document key/) }
    ]);
  });

  it("skips the slot when a mid-run claim finds a pointer with no documentKey", async () => {
    const { deps, calls } = makeDeps([mkDoc("a"), mkDoc("b")], {}, { claimResult: "" });
    const res = await backfillSpace(space, { dryRun: false }, deps);
    expect(calls).toEqual(["list", `read ${slotPointerPath}`, `claim ${slotPointerPath} a`]);
    expect(res).toMatchObject({ claimed: 0, deleted: 0 });
    expect(res.skipped.map(s => s.key)).toEqual(["a", "b"]);
  });

  it("hands the deletion a target that passes whyNotDeletable for the loser's own metadata", async () => {
    const targets: IDeletionTarget[] = [];
    const { deps } = makeDeps([mkDoc("a"), mkDoc("b")]);
    deps.remove = async (t) => { targets.push(t); };
    await backfillSpace(space, { dryRun: false }, deps);
    expect(targets).toEqual([{
      key: "b",
      firestorePath: "authed/p/documents/b",
      rtdbPaths: [
        "/authed/portals/p/classes/c1/users/group_o1_3/documents/b",
        "/authed/portals/p/classes/c1/users/group_o1_3/documentMetadata/b"
      ],
      slot: { contextId: "c1", offeringId: "o1", groupId: "3", uid: "group_o1_3" }
    }]);
    expect(whyNotDeletable(groupDocData(), targets[0])).toBeUndefined();
  });

  it("stops before removing a document whose backup failed", async () => {
    const { deps, calls } = makeDeps([mkDoc("a"), mkDoc("b")]);
    deps.backup = async () => { calls.push("backup b"); throw new Error("disk full"); };
    await expect(backfillSpace(space, { dryRun: false }, deps)).rejects.toThrow("disk full");
    expect(calls).not.toContain("remove b");
  });

  it("does nothing to a slot with a single, already pointed document and no legacy pointers", async () => {
    const { deps, calls } = makeDeps([mkDoc("a")], { [slotPointerPath]: "a" });
    const res = await backfillSpace(space, { dryRun: false }, deps);
    expect(calls).toEqual(["list", `read ${slotPointerPath}`, ...readLegacy]);
    expect(res).toMatchObject({ slots: 1, alreadyPointed: 1, claimed: 0, deleted: 0, legacyPointersDeleted: 0 });
  });
});

// Firestore metadata of group document "b" in group "3" of offering "o1" in class "c1".
const groupDocData = (fields: Record<string, unknown> = {}) => ({
  type: "axes", context_id: "c1", offeringId: "o1", groupId: "3", uid: "group_o1_3", ...fields
});

const target: IDeletionTarget = {
  key: "b",
  firestorePath: "authed/p/documents/b",
  rtdbPaths: [
    "/authed/portals/p/classes/c1/users/group_o1_3/documents/b",
    "/authed/portals/p/classes/c1/users/group_o1_3/documentMetadata/b"
  ],
  slot: { contextId: "c1", offeringId: "o1", groupId: "3", uid: "group_o1_3" }
};

describe("whyNotDeletable", () => {
  it("accepts a group document under either generic type", () => {
    expect(whyNotDeletable(groupDocData(), target)).toBeUndefined();
    expect(whyNotDeletable(groupDocData({ type: "group" }), target)).toBeUndefined();
  });

  it.each([
    ["missing metadata", undefined],
    ["a personal document", groupDocData({ type: "personal" })],
    ["a problem document", groupDocData({ type: "problem" })],
    ["a document without a group", groupDocData({ groupId: undefined })],
    ["another group's document", groupDocData({ groupId: "4" })],
    ["another offering's document", groupDocData({ offeringId: "o2" })],
    ["another class's document", groupDocData({ context_id: "c2" })],
    ["a student-owned document", groupDocData({ uid: "student1" })]
  ])("refuses %s", (_label, data) => {
    expect(whyNotDeletable(data, target)).toEqual(expect.any(String));
  });

  it.each([
    ["a Firestore path naming another document", { firestorePath: "authed/p/documents/a" }],
    ["a realtime-database path under a student", { rtdbPaths: [
      "/authed/portals/p/classes/c1/users/student1/documents/b",
      "/authed/portals/p/classes/c1/users/group_o1_3/documentMetadata/b"
    ] }],
    ["a realtime-database path naming a whole user", { rtdbPaths: [
      "/authed/portals/p/classes/c1/users/group_o1_3",
      "/authed/portals/p/classes/c1/users/group_o1_3/documentMetadata/b"
    ] }],
    ["an extra realtime-database path", { rtdbPaths: [...target.rtdbPaths, "/authed/portals/p/classes/c1"] }],
    ["a slot uid that is not the group owner", {
      slot: { ...target.slot, uid: "student1" }
    }]
  ])("refuses a target with %s", (_label, change) => {
    const data = groupDocData(change.slot ? { uid: change.slot.uid } : {});
    expect(whyNotDeletable(data, { ...target, ...change })).toEqual(expect.any(String));
  });
});

describe("createSpaceDeps", () => {
  /** An in-memory Firestore and realtime database that record every write and deletion. */
  function makeHandles(firestoreDocs: Record<string, Record<string, any>>) {
    const writes: string[] = [];
    const snap = (p: string) => ({
      exists: p in firestoreDocs, data: () => firestoreDocs[p], get: (f: string) => firestoreDocs[p]?.[f]
    });
    const firestore = {
      doc: (p: string) => ({
        path: p,
        get: async () => snap(p),
        delete: async () => { writes.push(`firestore delete ${p}`); },
        listCollections: async () => []
      }),
      runTransaction: async (fn: (txn: any) => Promise<unknown>) => fn({
        get: async (ref: any) => snap(ref.path),
        create: (ref: any, data: any) => { writes.push(`create ${ref.path} ${JSON.stringify(data)}`); },
        update: (ref: any, data: any) => { writes.push(`update ${ref.path} ${JSON.stringify(data)}`); }
      }),
      recursiveDelete: async (ref: any) => { writes.push(`firestore recursiveDelete ${ref.path}`); }
    };
    const database = { ref: (p: string) => ({ remove: async () => { writes.push(`rtdb remove ${p}`); } }) };
    const handles = {
      firestore, database, reader: { readNode: async () => null },
      serverTimestamp: () => "NOW", saveBackup: () => undefined
    };
    return { deps: createSpaceDeps(handles, space), writes };
  }

  it("claims with exactly the pointer fields and marks the winner canonical", async () => {
    const { deps, writes } = makeHandles({});
    expect(await deps.claim(slotPointerPath, "a")).toEqual({ documentKey: "a" });
    const pointer = { documentKey: "a", createdAt: "NOW", createdBy: kPointerCreatedBy };
    expect(writes).toEqual([
      `create ${slotPointerPath} ${JSON.stringify(pointer)}`,
      `update authed/p/documents/a ${JSON.stringify({ canonical: "default" })}`
    ]);
  });

  it("returns an existing pointer's key without writing", async () => {
    const { deps, writes } = makeHandles({ [slotPointerPath]: { documentKey: "b" } });
    expect(await deps.claim(slotPointerPath, "a")).toEqual({ documentKey: "b" });
    expect(writes).toEqual([]);
  });

  it("removes the realtime-database copies before the Firestore document", async () => {
    const { deps, writes } = makeHandles({ [target.firestorePath]: groupDocData() });
    await deps.remove(target);
    expect(writes).toEqual([
      `rtdb remove ${target.rtdbPaths[0]}`, `rtdb remove ${target.rtdbPaths[1]}`,
      `firestore recursiveDelete ${target.firestorePath}`
    ]);
  });

  it("deletes nothing when the document is not a group document of the slot", async () => {
    const { deps, writes } = makeHandles({ [target.firestorePath]: groupDocData({ type: "personal" }) });
    await expect(deps.remove(target)).rejects.toThrow(/refusing to delete/);
    expect(writes).toEqual([]);
  });

  it("deletes nothing when the document is already gone", async () => {
    const { deps, writes } = makeHandles({});
    await expect(deps.remove(target)).rejects.toThrow(/no Firestore metadata/);
    expect(writes).toEqual([]);
  });
});
