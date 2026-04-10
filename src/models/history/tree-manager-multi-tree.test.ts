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

    // When a single history entry has records for multiple trees and
    // one tree's record fails, all trees must roll back to a consistent
    // position. In the single-entry case, that means every tree that
    // applied anything for the entry has it rolled back.
    it("rolls back other trees when one tree fails mid-entry", async () => {
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

      // Position stops at the failing entry.
      expect(manager.numHistoryEventsApplied).toBe(0);
      expect(manager.historyPlaybackFailures.length).toBe(1);
      expect(manager.historyPlaybackFailures[0].historyIndex).toBe(0);

      // Both trees are consistent with position 0.
      expect(treeA.value).toBeUndefined();
      expect(treeB.value).toBeUndefined();
    });

    // Tree A succeeds through all entries, including entries past the
    // one where tree B fails. Tree A's state past the failing entry
    // must be rolled back so both trees are consistent with the
    // stop position.
    it("rolls back other trees that succeeded past the failing entry (forward)", async () => {
      const { manager, treeA, treeB } = setupManager();
      const history = [
        makeEntry([setValueRecord("treeA", undefined, "A1")]),    // 0
        makeEntry([setValueRecord("treeA", "A1", "A2")]),         // 1
        makeEntry([setValueRecord("treeB", undefined, "B1")]),    // 2
        makeEntry([failingRecord("treeB")]),                       // 3
        makeEntry([setValueRecord("treeA", "A2", "A3")]),         // 4
      ];
      manager.setChangeDocument({ history } as any);
      manager.setNumHistoryEntriesApplied(0);

      await jestSpyConsole("warn", async () => {
        await manager.goToHistoryEntry(5);
      });

      // Scrub stops at the earliest failing entry (index 3).
      expect(manager.numHistoryEventsApplied).toBe(3);
      // treeA would have applied entry 4 past the failure point —
      // that must be rolled back so treeA reflects state at position 3
      // (entries 0 and 1 applied, entry 4 not).
      expect(treeA.value).toBe("A2");
      expect(treeB.value).toBe("B1");
      expect(manager.historyPlaybackFailures.length).toBe(1);
      expect(manager.historyPlaybackFailures[0].historyIndex).toBe(3);
      expect(manager.historyPlaybackFailures[0].direction).toBe("redo");
    });

    // Backward equivalent. Tree B successfully undoes an entry whose
    // index is before the earliest (= max, for backward) failing
    // entry — that undo must be re-applied forward so tree B reflects
    // the stop position.
    it("re-applies other trees that succeeded past the failing entry (backward)", async () => {
      const { manager, treeA, treeB } = setupManager();
      const history = [
        makeEntry([setValueRecord("treeB", undefined, "B1")]),    // 0
        makeEntry([setValueRecord("treeA", undefined, "A1")]),    // 1
        makeEntry([setValueRecord("treeA", "A1", "A2")]),         // 2
        makeEntry([failingRecord("treeA")]),                       // 3
        makeEntry([setValueRecord("treeA", "A2", "A3")]),         // 4
      ];
      // Seed state matching "all 5 entries applied".
      treeA.setValue("A3");
      treeB.setValue("B1");
      manager.setChangeDocument({ history } as any);
      manager.setNumHistoryEntriesApplied(5);

      await jestSpyConsole("warn", async () => {
        await manager.goToHistoryEntry(0);
      });

      // Scrub stops at position just-after the failing entry going
      // backward (failedEntryIndex + 1 = 4).
      expect(manager.numHistoryEventsApplied).toBe(4);
      // State at position 4: entries 0..3 applied, entry 4 not.
      // treeA = A2 (entry 1 → A1, entry 2 → A2, entry 3 is broken and
      // doesn't affect /value, entry 4 not applied).
      expect(treeA.value).toBe("A2");
      // treeB successfully undid entry 0 during the backward batch;
      // that must be re-applied since entry 0 is < stop position 4.
      expect(treeB.value).toBe("B1");
      expect(manager.historyPlaybackFailures.length).toBe(1);
      expect(manager.historyPlaybackFailures[0].historyIndex).toBe(3);
      expect(manager.historyPlaybackFailures[0].direction).toBe("undo");
    });

    // When multiple trees fail, use the earliest (min) index forward.
    it("uses the earliest failing index when multiple trees fail (forward)", async () => {
      const { manager, treeA, treeB } = setupManager();
      const history = [
        makeEntry([setValueRecord("treeA", undefined, "A1")]),    // 0
        makeEntry([setValueRecord("treeB", undefined, "B1")]),    // 1
        makeEntry([failingRecord("treeA")]),                       // 2
        makeEntry([setValueRecord("treeB", "B1", "B2")]),         // 3
        makeEntry([failingRecord("treeB")]),                       // 4
        makeEntry([setValueRecord("treeA", "A1", "A2")]),         // 5
      ];
      manager.setChangeDocument({ history } as any);
      manager.setNumHistoryEntriesApplied(0);

      await jestSpyConsole("warn", async () => {
        await manager.goToHistoryEntry(6);
      });

      // Earliest (min) failing index forward is treeA's at 2.
      expect(manager.numHistoryEventsApplied).toBe(2);
      // Position 2: entries 0 and 1 applied.
      expect(treeA.value).toBe("A1");
      // treeB applied entry 3 past the stop position and must have it
      // rolled back to B1.
      expect(treeB.value).toBe("B1");
      // Both failures should be recorded.
      expect(manager.historyPlaybackFailures.length).toBe(2);
      const indices = manager.historyPlaybackFailures.map(f => f.historyIndex).sort();
      expect(indices).toEqual([2, 4]);
      manager.historyPlaybackFailures.forEach(f => {
        expect(f.direction).toBe("redo");
      });
    });

    // When multiple trees fail backward, use the latest (max) index.
    it("uses the latest failing index when multiple trees fail (backward)", async () => {
      const { manager, treeA, treeB } = setupManager();
      const history = [
        makeEntry([setValueRecord("treeA", undefined, "A1")]),    // 0
        makeEntry([setValueRecord("treeB", undefined, "B1")]),    // 1
        makeEntry([failingRecord("treeA")]),                       // 2
        makeEntry([setValueRecord("treeB", "B1", "B2")]),         // 3
        makeEntry([failingRecord("treeB")]),                       // 4
        makeEntry([setValueRecord("treeA", "A1", "A2")]),         // 5
      ];
      // Seed at position 6 (all applied). Entries 2 and 4 are broken
      // and don't modify any value; treeA ends at A2, treeB ends at B2.
      treeA.setValue("A2");
      treeB.setValue("B2");
      manager.setChangeDocument({ history } as any);
      manager.setNumHistoryEntriesApplied(6);

      await jestSpyConsole("warn", async () => {
        await manager.goToHistoryEntry(0);
      });

      // Latest (max) failing index backward is treeB's at 4;
      // numHistoryEventsApplied = 4 + 1 = 5.
      expect(manager.numHistoryEventsApplied).toBe(5);
      // Position 5: entries 0..4 applied, entry 5 not.
      // treeA = A1 (entry 0 → A1; entry 5 not applied).
      expect(treeA.value).toBe("A1");
      // treeB = B2 (entries 1 → B1 and 3 → B2).
      expect(treeB.value).toBe("B2");
      expect(manager.historyPlaybackFailures.length).toBe(2);
      const indices = manager.historyPlaybackFailures.map(f => f.historyIndex).sort();
      expect(indices).toEqual([2, 4]);
      manager.historyPlaybackFailures.forEach(f => {
        expect(f.direction).toBe("undo");
      });
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
