import { getCanonicalPointerPath, kDefaultCanonicalDocumentLabel } from "../../src/lib/scoped-document-pointers";
import { getGroupOwnerId } from "../../src/models/document/document-axes";
import {
  backfillSpace, decideSlot, groupIntoSlots, groupOwnerId, groupPointerRelativePath, kGroupPointerLabel,
  type IDeletionTarget, type IGroupDocRecord, type ISpaceDeps
} from "./backfill-group-canonical-pointers";

const space = { label: "authed/p", spacePath: "authed/p/documents", rtdbRoot: "/authed/portals/p" };

// A well-formed group document for group "3" of offering "o1" in class "c1".
const mkDoc = (key: string, fields: Partial<IGroupDocRecord> = {}): IGroupDocRecord => ({
  key, contextId: "c1", offeringId: "o1", groupId: "3", uid: "group_o1_3", ...fields
});

const slotPointerPath = "authed/p/canonical/v1/classes/c1/offerings/o1/owners/group_o1_3/slots/default";

/**
 * Deps that record every call in one ordered log, so a test can assert both what happened and in which
 * order — the backup-before-delete guarantee is an ordering property.
 */
function makeDeps(docs: IGroupDocRecord[], pointers: Record<string, string> = {},
  { claimResult }: { claimResult?: string } = {}) {
  const calls: string[] = [];
  const deps: ISpaceDeps = {
    listGroupDocs: async () => { calls.push("list"); return docs; },
    readPointer: async (path) => { calls.push(`read ${path}`); return pointers[path]; },
    claim: async (path, key) => { calls.push(`claim ${path} ${key}`); return claimResult ?? key; },
    backup: async (t: IDeletionTarget) => { calls.push(`backup ${t.key}`); },
    remove: async (t: IDeletionTarget) => { calls.push(`remove ${t.key}`); },
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
    const d = decideSlot(slot([mkDoc("a"), mkDoc("b", { canonical: "default" })]), "b");
    expect(d).toMatchObject({ action: "pointed", winner: "b" });
    expect(d.action !== "dangling" && d.losers.map(l => l.key)).toEqual(["a"]);
  });

  it("touches nothing when the pointer names a document not in the slot", () => {
    expect(decideSlot(slot([mkDoc("a"), mkDoc("b")]), "zzz")).toEqual({ action: "dangling", pointerKey: "zzz" });
  });

  it("keeps rather than deletes a losing document that is already marked canonical", () => {
    const d = decideSlot(slot([mkDoc("a"), mkDoc("b", { canonical: "default" })]), undefined);
    expect(d.action !== "dangling" && d.losers).toEqual([]);
    expect(d.action !== "dangling" && d.kept).toEqual([{ key: "b", reason: expect.stringMatching(/canonical/) }]);
  });
});

describe("backfillSpace", () => {
  it("dry run reads pointers but claims, backs up and removes nothing", async () => {
    const { deps, calls } = makeDeps([mkDoc("a"), mkDoc("b")]);
    const res = await backfillSpace(space, { dryRun: true }, deps);
    expect(calls).toEqual(["list", `read ${slotPointerPath}`]);
    expect(res).toMatchObject({ slots: 1, alreadyPointed: 0, claimed: 1, deleted: 1 });
  });

  it("claims, then backs up each loser before removing it", async () => {
    const { deps, calls } = makeDeps([mkDoc("a"), mkDoc("b"), mkDoc("c")]);
    const res = await backfillSpace(space, { dryRun: false }, deps);
    expect(calls).toEqual([
      "list", `read ${slotPointerPath}`, `claim ${slotPointerPath} a`,
      "backup b", "remove b", "backup c", "remove c"
    ]);
    expect(res).toMatchObject({ slots: 1, alreadyPointed: 0, claimed: 1, deleted: 2 });
  });

  it("deletes duplicates in a slot that already has a pointer, without claiming", async () => {
    const { deps, calls } = makeDeps([mkDoc("a"), mkDoc("b", { canonical: "default" })], { [slotPointerPath]: "b" });
    const res = await backfillSpace(space, { dryRun: false }, deps);
    expect(calls).toEqual(["list", `read ${slotPointerPath}`, "backup a", "remove a"]);
    expect(res).toMatchObject({ alreadyPointed: 1, claimed: 0, deleted: 1 });
  });

  it("converges on the document a client claimed mid-run instead of deleting it", async () => {
    // Between the read and the claim a student opened the group document and findLegacy claimed "b".
    const { deps, calls } = makeDeps([mkDoc("a"), mkDoc("b")], {}, { claimResult: "b" });
    const res = await backfillSpace(space, { dryRun: false }, deps);
    expect(calls).toEqual(["list", `read ${slotPointerPath}`, `claim ${slotPointerPath} a`, "backup a", "remove a"]);
    expect(res).toMatchObject({ claimed: 0, alreadyPointed: 1, deleted: 1 });
  });

  it("deletes nothing when a mid-run claim names a document outside the slot", async () => {
    const { deps, calls } = makeDeps([mkDoc("a"), mkDoc("b")], {}, { claimResult: "zzz" });
    const res = await backfillSpace(space, { dryRun: false }, deps);
    expect(calls).toEqual(["list", `read ${slotPointerPath}`, `claim ${slotPointerPath} a`]);
    expect(res.deleted).toBe(0);
    expect(res.skipped).toEqual([{ key: "zzz", reason: expect.stringMatching(/not in the slot/) }]);
  });

  it("hands the deletion the document's Firestore path and both realtime-database halves", async () => {
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
      ]
    }]);
  });

  it("stops before removing a document whose backup failed", async () => {
    const { deps, calls } = makeDeps([mkDoc("a"), mkDoc("b")]);
    deps.backup = async () => { calls.push("backup b"); throw new Error("disk full"); };
    await expect(backfillSpace(space, { dryRun: false }, deps)).rejects.toThrow("disk full");
    expect(calls).not.toContain("remove b");
  });

  it("does nothing to a slot with a single, already pointed document", async () => {
    const { deps, calls } = makeDeps([mkDoc("a", { canonical: "default" })], { [slotPointerPath]: "a" });
    const res = await backfillSpace(space, { dryRun: false }, deps);
    expect(calls).toEqual(["list", `read ${slotPointerPath}`]);
    expect(res).toMatchObject({ slots: 1, alreadyPointed: 1, claimed: 0, deleted: 0, skipped: [] });
  });
});
