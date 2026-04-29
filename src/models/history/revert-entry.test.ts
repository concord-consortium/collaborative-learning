import { buildRevertEntrySnapshot } from "./revert-entry";
import { HistoryEntry, HistoryEntrySnapshot, HistoryOperation } from "./history";

describe("buildRevertEntrySnapshot", () => {
  const original: HistoryEntrySnapshot = {
    id: "L1",
    tree: "main",
    model: "TestModel",
    action: "/setValue",
    undoable: true,
    state: "complete",
    records: [
      {
        tree: "treeA",
        action: "/setValue",
        patches: [
          { op: "replace", path: "/x", value: 1 },
          { op: "replace", path: "/y", value: 2 }
        ],
        inversePatches: [
          { op: "replace", path: "/x", value: 0 },
          { op: "replace", path: "/y", value: 0 }
        ]
      },
      {
        tree: "treeB",
        action: "/setValue",
        patches: [{ op: "replace", path: "/z", value: 3 }],
        inversePatches: [{ op: "replace", path: "/z", value: 0 }]
      }
    ]
  };

  it("marks the revert and preserves model/action/tree metadata", () => {
    const revert = buildRevertEntrySnapshot(original, ["R1", "R2"]);
    expect(revert.isRevert).toBe(true);
    expect(revert.undoable).toBe(false);
    expect(revert.state).toBe("complete");
    expect(revert.revertsEntryId).toBe("L1");
    expect(revert.triggeringBatchIds).toEqual(["R1", "R2"]);
    expect(revert.tree).toBe("main");
    expect(revert.model).toBe("TestModel");
    expect(revert.action).toBe("/setValue");
    expect(revert.id).not.toBe("L1");
    expect(typeof revert.id).toBe("string");
    expect(revert.id.length).toBeGreaterThan(0);
  });

  it("reverses the records array and swaps patches with reversed inversePatches per record", () => {
    const revert = buildRevertEntrySnapshot(original, ["R1"]);

    // Records reversed: treeB first, then treeA.
    expect(revert.records).toHaveLength(2);
    expect(revert.records![0].tree).toBe("treeB");
    expect(revert.records![1].tree).toBe("treeA");

    // treeB record: patches become reversed original.inversePatches;
    // inversePatches become reversed original.patches.
    expect(revert.records![0].patches).toEqual([
      { op: "replace", path: "/z", value: 0 }
    ]);
    expect(revert.records![0].inversePatches).toEqual([
      { op: "replace", path: "/z", value: 3 }
    ]);

    // treeA record: both arrays reversed during swap.
    expect(revert.records![1].patches).toEqual([
      { op: "replace", path: "/y", value: 0 },
      { op: "replace", path: "/x", value: 0 }
    ]);
    expect(revert.records![1].inversePatches).toEqual([
      { op: "replace", path: "/y", value: 2 },
      { op: "replace", path: "/x", value: 1 }
    ]);
  });

  it("handles an original with no records", () => {
    const bare: HistoryEntrySnapshot = {
      id: "L2",
      state: "complete",
      records: []
    };
    const revert = buildRevertEntrySnapshot(bare, []);
    expect(revert.records).toEqual([]);
    expect(revert.triggeringBatchIds).toEqual([]);
  });

  it("produces forward-apply patches that undo the original (Redo dispatch)", () => {
    // getPatches(Redo) returns the record's `patches` array as-is.
    // For a revert entry, those patches ARE the inverses of the original
    // (reversed), so applying them undoes the original's effect.
    const revertSnap = buildRevertEntrySnapshot(original, ["R1"]);
    const revert = HistoryEntry.create(revertSnap);

    // records[0] is treeB (reversed from original). Its patches = original
    // treeB inversePatches reversed = [{z:0}].
    expect(revert.records[0].getPatches(HistoryOperation.Redo)).toEqual([
      { op: "replace", path: "/z", value: 0 }
    ]);
    // records[1] is treeA. Its patches = original treeA inversePatches reversed
    // = [{y:0},{x:0}].
    expect(revert.records[1].getPatches(HistoryOperation.Redo)).toEqual([
      { op: "replace", path: "/y", value: 0 },
      { op: "replace", path: "/x", value: 0 }
    ]);
  });

  it("produces backward-apply patches that re-apply the original (Undo dispatch)", () => {
    // getPatches(Undo) returns the record's `inversePatches` reversed.
    // For a revert entry, those inversePatches ARE the original's forward
    // patches (reversed), so reversing them again yields the original effect.
    const revertSnap = buildRevertEntrySnapshot(original, ["R1"]);
    const revert = HistoryEntry.create(revertSnap);

    // records[0] is treeB. Its inversePatches = [{z:3}]; reversed = [{z:3}].
    expect(revert.records[0].getPatches(HistoryOperation.Undo)).toEqual([
      { op: "replace", path: "/z", value: 3 }
    ]);
    // records[1] is treeA. Its inversePatches = [{y:2},{x:1}]; reversed = [{x:1},{y:2}].
    expect(revert.records[1].getPatches(HistoryOperation.Undo)).toEqual([
      { op: "replace", path: "/x", value: 1 },
      { op: "replace", path: "/y", value: 2 }
    ]);
  });
});
