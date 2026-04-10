import { nanoid } from "nanoid";
import {
  applyPatch, getSnapshot, IJsonPatch, Instance, onPatch, types
} from "mobx-state-tree";
import { TreeManager } from "./tree-manager";
import { HistoryEntrySnapshot } from "./history";
import { PatchApplicationError } from "./tree";

// These tests exercise the multi-tree code paths in TreeManager
// (replayHistoryToTrees, goToHistoryEntry, addTreePatchRecord) without
// dragging in DocumentContentModel/tiles. A minimal TestTree implements
// the TreeAPI surface directly so we can register multiple trees with a
// single TreeManager and drive them with hand-crafted history entries.
//
// Multi-tree support exists in the framework but is not currently used
// by CLUE, so these tests serve as both regression coverage and a
// characterization of current behavior — including at least one known
// gap (cross-tree rollback on partial failure) flagged with an
// explanatory comment.

const mockCreateFirestoreMetadataDocument_v2 = jest.fn();
const mockPostDocumentComment_v2 = jest.fn();
const mockHttpsCallable = jest.fn((fn: string) => {
  switch (fn) {
    case "createFirestoreMetadataDocument_v2":
      return mockCreateFirestoreMetadataDocument_v2;
    case "postDocumentComment_v2":
      return mockPostDocumentComment_v2;
  }
});
jest.mock("firebase/app", () => ({
  functions: () => ({
    httpsCallable: (fn: string) => mockHttpsCallable(fn)
  })
}));

// A minimal Tree implementation that satisfies the TreeAPI shape the
// TreeManager calls. It mirrors the batched-applyPatch + onPatch
// counting pattern from the real Tree model so that PatchApplicationError
// is thrown with an accurate numApplied count — which is what the
// goToHistoryEntry rollback logic depends on.
const TestTree = types.model("TestTree", {
  myId: types.string,
  value: types.maybe(types.string),
  counter: types.optional(types.number, 0),
})
.volatile(self => ({
  applyingManagerPatches: false,
  startCount: 0,
  finishCount: 0,
}))
.views(self => ({
  get treeId(): string { return self.myId; }
}))
.actions(self => ({
  setValue(v: string | undefined) { self.value = v; },
  setCounter(c: number) { self.counter = c; },

  // --- TreeAPI ---

  startApplyingPatchesFromManager(_historyEntryId: string, _exchangeId: string) {
    self.applyingManagerPatches = true;
    self.startCount++;
    return Promise.resolve();
  },

  applyPatchesFromManager(
    _historyEntryId: string, _exchangeId: string, patchesToApply: readonly IJsonPatch[]
  ) {
    for (const patch of patchesToApply) {
      if (!patch.path) {
        throw new Error("History patches must have a non-empty path.");
      }
    }
    let numApplied = 0;
    const disposer = onPatch(self, () => { numApplied++; });
    try {
      applyPatch(self, patchesToApply);
    } catch (e) {
      throw new PatchApplicationError(numApplied, e);
    } finally {
      disposer();
    }
    return Promise.resolve();
  },

  finishApplyingPatchesFromManager(_historyEntryId: string, _exchangeId: string) {
    self.applyingManagerPatches = false;
    self.finishCount++;
    return Promise.resolve();
  },

  applySharedModelSnapshotFromManager(
    _historyEntryId: string, _exchangeId: string, _snapshot: any
  ) {
    return Promise.resolve();
  },
}));
interface TestTreeType extends Instance<typeof TestTree> {}

function setupManager() {
  const manager = TreeManager.create({ document: {}, undoStore: {} });
  const treeA = TestTree.create({ myId: "treeA" });
  const treeB = TestTree.create({ myId: "treeB" });
  manager.putTree("treeA", treeA);
  manager.putTree("treeB", treeB);
  return { manager, treeA, treeB };
}

interface RecordSpec {
  tree: string;
  patches: IJsonPatch[];
  inversePatches: IJsonPatch[];
  action?: string;
}

function makeEntry(records: RecordSpec[], opts?: { action?: string }): HistoryEntrySnapshot {
  const action = opts?.action ?? "/test";
  return {
    id: nanoid(),
    created: Date.now(),
    model: "TestTree",
    action,
    tree: records[0]?.tree,
    undoable: true,
    state: "complete",
    records: records.map(r => ({
      tree: r.tree,
      action: r.action ?? action,
      patches: r.patches,
      inversePatches: r.inversePatches,
    })),
  };
}

// Simple single-tree setValue record.
function setValueRecord(tree: string, from: string | undefined, to: string): RecordSpec {
  return {
    tree,
    patches: [{ op: "replace", path: "/value", value: to }],
    inversePatches: [{ op: "replace", path: "/value", value: from }],
  };
}

// A record whose patches reference a non-existent path. applyPatch will
// throw in either direction.
function failingRecord(tree: string): RecordSpec {
  return {
    tree,
    patches: [{ op: "replace", path: "/nothing/here", value: 1 }],
    inversePatches: [{ op: "replace", path: "/nothing/here", value: 0 }],
  };
}

describe("TreeManager multi-tree support", () => {
  describe("replayHistoryToTrees", () => {
    it("routes patches to the correct tree when each entry targets one tree", async () => {
      const { manager, treeA, treeB } = setupManager();
      const history = [
        makeEntry([setValueRecord("treeA", undefined, "A1")]),
        makeEntry([setValueRecord("treeB", undefined, "B1")]),
        makeEntry([setValueRecord("treeA", "A1", "A2")]),
      ];
      manager.setChangeDocument({ history } as any);

      await manager.replayHistoryToTrees();

      expect(treeA.value).toBe("A2");
      expect(treeB.value).toBe("B1");
      // Every registered tree should have been started/finished exactly once,
      // even trees that received no patches in a given replay.
      expect(treeA.startCount).toBe(1);
      expect(treeA.finishCount).toBe(1);
      expect(treeB.startCount).toBe(1);
      expect(treeB.finishCount).toBe(1);
      expect(treeA.applyingManagerPatches).toBe(false);
      expect(treeB.applyingManagerPatches).toBe(false);
    });

    it("applies records from a single history entry to multiple trees", async () => {
      const { manager, treeA, treeB } = setupManager();
      const history = [
        makeEntry([
          setValueRecord("treeA", undefined, "A1"),
          setValueRecord("treeB", undefined, "B1"),
        ]),
      ];
      manager.setChangeDocument({ history } as any);

      await manager.replayHistoryToTrees();

      expect(treeA.value).toBe("A1");
      expect(treeB.value).toBe("B1");
    });

    it("leaves registered trees in their initial state when no history targets them", async () => {
      const { manager, treeA, treeB } = setupManager();
      const history = [
        makeEntry([setValueRecord("treeA", undefined, "A1")]),
      ];
      manager.setChangeDocument({ history } as any);

      await manager.replayHistoryToTrees();

      expect(treeA.value).toBe("A1");
      expect(treeB.value).toBeUndefined();
      // treeB still gets the start/finish lifecycle calls.
      expect(treeB.startCount).toBe(1);
      expect(treeB.finishCount).toBe(1);
    });

    it("silently ignores patches whose tree id isn't registered", async () => {
      const { manager, treeA, treeB } = setupManager();
      const history = [
        makeEntry([setValueRecord("treeA", undefined, "A1")]),
        makeEntry([setValueRecord("ghostTree", undefined, "X")]),
      ];
      manager.setChangeDocument({ history } as any);

      // Should not throw.
      await manager.replayHistoryToTrees();

      expect(treeA.value).toBe("A1");
      expect(treeB.value).toBeUndefined();
    });
  });

  describe("goToHistoryEntry", () => {
    it("scrubs forward across multiple trees", async () => {
      const { manager, treeA, treeB } = setupManager();
      const history = [
        makeEntry([setValueRecord("treeA", undefined, "A1")]),
        makeEntry([setValueRecord("treeB", undefined, "B1")]),
        makeEntry([setValueRecord("treeA", "A1", "A2")]),
      ];
      manager.setChangeDocument({ history } as any);
      manager.setNumHistoryEntriesApplied(0);

      await manager.goToHistoryEntry(3);

      expect(treeA.value).toBe("A2");
      expect(treeB.value).toBe("B1");
      expect(manager.numHistoryEventsApplied).toBe(3);
    });

    it("scrubs backward across multiple trees", async () => {
      const { manager, treeA, treeB } = setupManager();
      const history = [
        makeEntry([setValueRecord("treeA", undefined, "A1")]),
        makeEntry([setValueRecord("treeB", undefined, "B1")]),
        makeEntry([setValueRecord("treeA", "A1", "A2")]),
      ];
      // Seed state at "all applied".
      treeA.setValue("A2");
      treeB.setValue("B1");
      manager.setChangeDocument({ history } as any);
      manager.setNumHistoryEntriesApplied(3);

      await manager.goToHistoryEntry(0);

      expect(treeA.value).toBeUndefined();
      expect(treeB.value).toBeUndefined();
      expect(manager.numHistoryEventsApplied).toBe(0);
    });

    it("scrubs to an intermediate position, updating only affected trees", async () => {
      const { manager, treeA, treeB } = setupManager();
      const history = [
        makeEntry([setValueRecord("treeA", undefined, "A1")]),
        makeEntry([setValueRecord("treeB", undefined, "B1")]),
        makeEntry([setValueRecord("treeA", "A1", "A2")]),
      ];
      manager.setChangeDocument({ history } as any);
      manager.setNumHistoryEntriesApplied(0);

      await manager.goToHistoryEntry(1);
      expect(treeA.value).toBe("A1");
      expect(treeB.value).toBeUndefined();

      await manager.goToHistoryEntry(2);
      expect(treeA.value).toBe("A1");
      expect(treeB.value).toBe("B1");

      await manager.goToHistoryEntry(3);
      expect(treeA.value).toBe("A2");
      expect(treeB.value).toBe("B1");

      await manager.goToHistoryEntry(0);
      expect(treeA.value).toBeUndefined();
      expect(treeB.value).toBeUndefined();
    });

    it("applies combined records from a single entry atomically across trees", async () => {
      const { manager, treeA, treeB } = setupManager();
      const history = [
        makeEntry([
          setValueRecord("treeA", undefined, "A1"),
          setValueRecord("treeB", undefined, "B1"),
        ]),
      ];
      manager.setChangeDocument({ history } as any);
      manager.setNumHistoryEntriesApplied(0);

      await manager.goToHistoryEntry(1);
      expect(treeA.value).toBe("A1");
      expect(treeB.value).toBe("B1");

      await manager.goToHistoryEntry(0);
      expect(treeA.value).toBeUndefined();
      expect(treeB.value).toBeUndefined();
    });

    it("records a failure when one tree's patches fail during a multi-tree scrub", async () => {
      const { manager, treeA } = setupManager();
      const history = [
        makeEntry([setValueRecord("treeA", undefined, "A1")]),
        makeEntry([failingRecord("treeB")]),
      ];
      manager.setChangeDocument({ history } as any);
      manager.setNumHistoryEntriesApplied(0);

      await jestSpyConsole("warn", async () => {
        await manager.goToHistoryEntry(2);
      });

      // The failing entry is entry 1, so numHistoryEventsApplied stops at 1.
      expect(manager.numHistoryEventsApplied).toBe(1);
      expect(manager.historyPlaybackFailures.length).toBe(1);
      expect(manager.historyPlaybackFailures[0].historyIndex).toBe(1);
      expect(manager.historyPlaybackFailures[0].direction).toBe("redo");
      // treeA should reflect entry 0 having been applied.
      expect(treeA.value).toBe("A1");
    });

    // This test characterizes a *known gap* in the multi-tree rollback
    // logic that tree-manager.ts:573-579 calls out with a TODO. When a
    // scrub spans an entry that has records for multiple trees, the
    // trees apply their batches in parallel. If one tree's record fails,
    // only that tree's partial application is rolled back — the other
    // trees' fully-applied records in the same entry are NOT rolled
    // back, even though numHistoryEventsApplied is rewound to before
    // that entry. This leaves the other trees' state inconsistent with
    // what numHistoryEventsApplied claims.
    //
    // If/when this is fixed, this test should be updated to assert the
    // corrected (consistent) behavior.
    it("KNOWN GAP: does not roll back other trees when one tree fails mid-entry", async () => {
      const { manager, treeA, treeB } = setupManager();
      const history = [
        makeEntry([
          setValueRecord("treeA", undefined, "A1"),
          failingRecord("treeB"),
        ]),
      ];
      manager.setChangeDocument({ history } as any);
      manager.setNumHistoryEntriesApplied(0);

      await jestSpyConsole("warn", async () => {
        await manager.goToHistoryEntry(1);
      });

      // The manager thinks entry 0 has NOT been applied (it rewound to
      // before the failing entry).
      expect(manager.numHistoryEventsApplied).toBe(0);
      expect(manager.historyPlaybackFailures.length).toBe(1);
      expect(manager.historyPlaybackFailures[0].historyIndex).toBe(0);

      // But treeA has in fact been mutated, exposing the inconsistency:
      // manager position says "nothing applied", treeA says "A1".
      expect(treeA.value).toBe("A1");
      // treeB's partial application (of zero good patches) was rolled
      // back, so it is still in the initial state.
      expect(treeB.value).toBeUndefined();
    });
  });

  describe("addTreePatchRecord with multiple trees", () => {
    it("aggregates records from different trees into a single history entry", async () => {
      const { manager } = setupManager();

      const historyEntryId = nanoid();
      const entry = manager.createHistoryEntry({
        id: historyEntryId,
        exchangeId: "create",
        tree: "treeA",
        model: "TestTree",
        action: "/combined",
        undoable: true,
      });

      const exchangeA = nanoid();
      const exchangeB = nanoid();
      await manager.startExchange(historyEntryId, exchangeA, "treeA patches");
      await manager.startExchange(historyEntryId, exchangeB, "treeB patches");

      manager.addTreePatchRecord(historyEntryId, exchangeA, {
        tree: "treeA",
        action: "/combined",
        patches: [{ op: "replace", path: "/value", value: "A" }],
        inversePatches: [{ op: "replace", path: "/value", value: undefined }],
      });
      manager.addTreePatchRecord(historyEntryId, exchangeB, {
        tree: "treeB",
        action: "/combined",
        patches: [{ op: "replace", path: "/value", value: "B" }],
        inversePatches: [{ op: "replace", path: "/value", value: undefined }],
      });

      // The create exchange is the last one still open; closing it
      // completes the entry.
      manager.addTreePatchRecord(historyEntryId, "create", {
        tree: "treeA",
        action: "/combined",
        patches: [],
        inversePatches: [],
      });

      expect(entry.state).toBe("complete");
      const historySnap = getSnapshot(manager.document.history);
      expect(historySnap.length).toBe(1);
      const storedRecords = historySnap[0].records as ReadonlyArray<{ tree: string }>;
      expect(storedRecords.map(r => r.tree).sort()).toEqual(["treeA", "treeB"]);
    });
  });
});

// Keeps TS happy about the interface export even though we don't use it
// directly elsewhere in the file.
export type { TestTreeType };
