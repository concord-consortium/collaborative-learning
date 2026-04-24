import { applyPatch, IJsonPatch, Instance, types } from "mobx-state-tree";
import { Firestore } from "../../lib/firestore";
import { UserContextProvider } from "../stores/user-context-provider";
import { TreeManager } from "./tree-manager";
import { HistoryEntry, HistoryEntrySnapshot } from "./history";
import { IFirestoreHistoryEntryDoc, getLastHistoryEntry as _getLastHistoryEntry } from "./history-firestore";
import { FirestoreHistoryManagerConcurrent } from "./firestore-history-manager-concurrent";

jest.mock("./history-firestore");
const getLastHistoryEntry = jest.mocked(_getLastHistoryEntry);

// Minimal tree with an array of items, modeling a drawing-like tile.
// Patches to this tree use numeric array indices, which is the
// source of the corruption GD-6 is preventing: when a remote entry
// removes items[0], the local patch targeting items[1] silently
// lands on a different object.
//
// `key` and `uid` are here so an instance can be registered as the
// TreeManager's mainDocument. waitUntilEnvironmentAndMetadataDocReady
// checks for a mainDocument with a key before allowing history work,
// and setMainDocument uses `key` to also register the document as the
// tree for that id.
const Item = types.model("Item", {
  id: types.identifier,
  color: types.optional(types.string, "white"),
});
interface ItemType extends Instance<typeof Item> {}

const ArrayTestTree = types.model("ArrayTestTree", {
  key: types.string,
  uid: types.string,
  items: types.array(Item),
})
.volatile(self => ({
  applyingManagerPatches: false,
  // Stub metadata to satisfy the IMainDocument shape; nothing reads it
  // in these tests.
  metadata: {} as any,
}))
.views(self => ({
  get treeId(): string { return self.key; },
}))
.actions(self => ({
  setItems(newItems: ItemType[]) {
    self.items.replace(newItems);
  },

  // --- TreeAPI surface ---
  startApplyingPatchesFromManager(_h: string, _e: string) {
    self.applyingManagerPatches = true;
    return Promise.resolve();
  },
  applyPatchesFromManager(_h: string, _e: string, patchesToApply: readonly IJsonPatch[]) {
    applyPatch(self, patchesToApply as IJsonPatch[]);
    return Promise.resolve();
  },
  finishApplyingPatchesFromManager(_h: string, _e: string) {
    self.applyingManagerPatches = false;
    return Promise.resolve();
  },
  applySharedModelSnapshotFromManager(_h: string, _e: string, _s: any) {
    return Promise.resolve();
  },
}));

// A second test tree that matches the shape CLUE's document-content
// uses, so we can drive patches with paths like
// /content/tileMap/<id>/content/value and exercise the scope-based
// merge logic in detectAndResolveFork. ArrayTestTree stays in place
// for the earlier tests that predate the merge work.
const DocMergeTile = types.model("DocMergeTile", {
  id: types.identifier,
  content: types.model({
    value: types.optional(types.string, "initial"),
  }),
});
const DocMergeShared = types.model("DocMergeShared", {
  id: types.identifier,
  value: types.optional(types.string, "initial"),
});
const DocMergeTestTree = types.model("DocMergeTestTree", {
  key: types.string,
  uid: types.string,
  content: types.model({
    tileMap: types.map(DocMergeTile),
    sharedModelMap: types.map(DocMergeShared),
    docName: types.optional(types.string, ""),
  }),
})
.volatile(self => ({
  applyingManagerPatches: false,
  metadata: {} as any,
}))
.views(self => ({
  get treeId(): string { return self.key; },
}))
.actions(self => ({
  startApplyingPatchesFromManager(_h: string, _e: string) {
    self.applyingManagerPatches = true;
    return Promise.resolve();
  },
  applyPatchesFromManager(_h: string, _e: string, patchesToApply: readonly IJsonPatch[]) {
    applyPatch(self, patchesToApply as IJsonPatch[]);
    return Promise.resolve();
  },
  finishApplyingPatchesFromManager(_h: string, _e: string) {
    self.applyingManagerPatches = false;
    return Promise.resolve();
  },
  applySharedModelSnapshotFromManager(_h: string, _e: string, _s: any) {
    return Promise.resolve();
  },
}));

async function setupDocMergeManager(firestoreOpts: FirestoreMockOptions = {}) {
  const treeId = "main";
  const manager = TreeManager.create({ document: {}, undoStore: {} });
  const tree = DocMergeTestTree.create({
    key: treeId,
    uid: "test-user",
    content: { tileMap: {}, sharedModelMap: {}, docName: "" },
  });
  manager.setMainDocument(tree as any);
  const { firestore, capture } = makeFirestoreMock(firestoreOpts);
  const historyManager = new FirestoreHistoryManagerConcurrent({
    firestore,
    userContextProvider: makeUserContextProviderMock(),
    treeManager: manager,
    uploadLocalHistory: true,
    syncRemoteHistory: false,
  });
  await historyManager.environmentAndMetadataDocReadyPromise;
  await historyManager.getInitialLastHistoryEntry();
  return { manager, tree, historyManager, treeId, firestoreCapture: capture };
}

interface FirestoreMockOptions {
  // Value returned for metadata.lastHistoryEntry inside the transaction.
  txMetadataLastHistoryEntry?: { id: string; index: number } | null;
}

interface FirestoreMockCapture {
  transactionSetCalls: Array<{ ref: any; data: any }>;
  transactionUpdateCalls: Array<{ ref: any; data: any }>;
}

function makeFirestoreMock(opts: FirestoreMockOptions = {}): {
  firestore: Firestore;
  capture: FirestoreMockCapture;
} {
  const capture: FirestoreMockCapture = {
    transactionSetCalls: [],
    transactionUpdateCalls: [],
  };
  const makeDocRef = (...parts: string[]): any => {
    const ref: any = { path: parts.join("/") };
    // The manager chains .withConverter(...) off documentRef before
    // passing to transaction.get; return the same ref so subsequent
    // calls keep the identity and the mock transaction.get can read
    // from it.
    ref.withConverter = () => ref;
    return ref;
  };
  const firestore = {
    doc: jest.fn(() => ({
      get: jest.fn(async () => ({ exists: true })),
      onSnapshot: jest.fn((callback: (doc: { exists: boolean }) => void) => {
        callback({ exists: true });
        return jest.fn();
      }),
    })),
    getFullPath: jest.fn((path: string) => path),
    documentRef: jest.fn((...parts: string[]) => makeDocRef(...parts)),
    timestamp: jest.fn(() => new Date()),
    runTransaction: jest.fn(async (fn: (tx: any) => Promise<void>) => {
      const tx = {
        get: jest.fn(async () => ({
          exists: true,
          data: () => ({
            lastHistoryEntry: opts.txMetadataLastHistoryEntry ?? null,
          }),
        })),
        set: jest.fn((ref: any, data: any) => {
          capture.transactionSetCalls.push({ ref, data });
        }),
        update: jest.fn((ref: any, data: any) => {
          capture.transactionUpdateCalls.push({ ref, data });
        }),
      };
      await fn(tx);
    }),
  } as unknown as Firestore;
  return { firestore, capture };
}

function makeUserContextProviderMock(): UserContextProvider {
  return {
    userContext: { uid: "test-user" },
  } as unknown as UserContextProvider;
}

// Async because the manager's constructor schedules an async
// waitUntilEnvironmentAndMetadataDocReady and an initial
// last-history-entry load (which writes to expectedRemoteHead). We
// await both here so each test starts in a deterministic state.
async function setupManager(firestoreOpts: FirestoreMockOptions = {}) {
  const treeId = "main";
  const manager = TreeManager.create({ document: {}, undoStore: {} });
  const tree = ArrayTestTree.create({ key: treeId, uid: "test-user" });
  // setMainDocument also registers the tree under its key, so we do
  // not need a separate putTree call.
  manager.setMainDocument(tree as any);

  const { firestore, capture } = makeFirestoreMock(firestoreOpts);

  const historyManager = new FirestoreHistoryManagerConcurrent({
    firestore,
    userContextProvider: makeUserContextProviderMock(),
    treeManager: manager,
    uploadLocalHistory: true,
    syncRemoteHistory: false,
  });

  await historyManager.environmentAndMetadataDocReadyPromise;
  await historyManager.getInitialLastHistoryEntry();

  return { manager, tree, historyManager, treeId, firestoreCapture: capture };
}

// Build a HistoryEntrySnapshot with a single record on the given tree.
function makeEntrySnapshot(
  id: string,
  treeId: string,
  patches: IJsonPatch[],
  inversePatches: IJsonPatch[],
): HistoryEntrySnapshot {
  return {
    id,
    tree: treeId,
    model: "ArrayTestTree",
    action: "/test",
    undoable: true,
    state: "complete",
    records: [{
      tree: treeId,
      action: "/test",
      patches,
      inversePatches,
    }],
  };
}

// Build an IFirestoreHistoryEntryDoc wrapping a snapshot.
function makeWrapperDoc(
  index: number,
  previousEntryId: string | undefined,
  entry: HistoryEntrySnapshot,
): IFirestoreHistoryEntryDoc {
  return { index, previousEntryId, entry };
}

describe("FirestoreHistoryManagerConcurrent", () => {
  beforeEach(() => {
    getLastHistoryEntry.mockReset();
    getLastHistoryEntry.mockResolvedValue(undefined);
  });

  describe("applyHistoryEntries — non-forked path", () => {
    it("applies a remote entry that continues from the local head", async () => {
      // Mock returns undefined (no prior remote history), so after
      // setupManager awaits the init, expectedRemoteHead is null.
      const { tree, historyManager } = await setupManager();

      // Initial state: 3 items.
      tree.setItems([
        Item.create({ id: "a" }),
        Item.create({ id: "b" }),
        Item.create({ id: "c" }),
      ]);

      // Remote entry R1: set items[1].color = "red".
      // previousEntryId = undefined (matches our null expectedRemoteHead).
      const r1 = makeEntrySnapshot(
        "R1",
        "main",
        [{ op: "replace", path: "/items/1/color", value: "red" }],
        [{ op: "replace", path: "/items/1/color", value: "white" }],
      );
      const r1wrap = makeWrapperDoc(0, undefined, r1);

      await historyManager.applyHistoryEntries([r1wrap]);

      expect(tree.items.map(i => i.id)).toEqual(["a", "b", "c"]);
      expect(tree.items[1].color).toBe("red");
      expect(historyManager.expectedRemoteHead).toBe("R1");
    });
  });

  describe("applyHistoryEntries — receive-side fork", () => {
    it("rolls back local uncommitted entries on mismatched previousEntryId", async () => {
      // Mock so the manager's initial-last-history-entry load
      // seeds expectedRemoteHead to "r0".
      getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
      const { manager, tree, historyManager } = await setupManager();
      expect(historyManager.expectedRemoteHead).toBe("r0");

      // Baseline: 3 items. A prior remote entry r0 is the last known
      // remote-chain tail.
      tree.setItems([
        Item.create({ id: "a" }),
        Item.create({ id: "b" }),
        Item.create({ id: "c" }),
      ]);

      // Simulate local user A: made a local edit L1 that set
      // items[1].color = "red". The patch has already been applied
      // locally, and L1 is in local history and in the upload queue.
      const l1Patches: IJsonPatch[] = [{ op: "replace", path: "/items/1/color", value: "red" }];
      const l1InversePatches: IJsonPatch[] = [{ op: "replace", path: "/items/1/color", value: "white" }];
      const l1Snapshot = makeEntrySnapshot("L1", "main", l1Patches, l1InversePatches);
      applyPatch(tree, l1Patches);
      const l1Entry = HistoryEntry.create(l1Snapshot);
      manager.addHistoryEntryAfterApplying(l1Entry);
      historyManager.completedHistoryEntryQueue.push(l1Entry);

      // Sanity: local state currently reflects A's edit.
      expect(tree.items[1].color).toBe("red");

      // Incoming remote entry R1 from user B: remove items[0].
      // previousEntryId = "r0", which matches expectedRemoteHead but
      // NOT our local head (which is L1) — that's the fork.
      const r1Snapshot = makeEntrySnapshot(
        "R1",
        "main",
        [{ op: "remove", path: "/items/0" }],
        [{ op: "add", path: "/items/0", value: { id: "a", color: "white" } }],
      );
      const r1wrap = makeWrapperDoc(1, "r0", r1Snapshot);

      await historyManager.applyHistoryEntries([r1wrap]);

      // Post-change expectations:
      // 1. L1's forward patches are reverted (items[1].color back to white).
      // 2. R1 applied (items[0] "a" removed).
      // 3. L1 stays in local history; a revert entry is appended; then R1.
      // 4. L1 removed from upload queue.
      // 5. expectedRemoteHead advances to R1.
      expect(tree.items.map(i => i.id)).toEqual(["b", "c"]);
      expect(tree.items[0].color).toBe("white");
      expect(tree.items[1].color).toBe("white");
      const ids = manager.document.history.map(e => e.id);
      expect(ids[0]).toBe("L1");
      expect(ids[ids.length - 1]).toBe("R1");
      expect(ids.length).toBe(3);
      const revert = manager.document.history[1];
      expect(revert.isRevert).toBe(true);
      expect(revert.revertsEntryId).toBe("L1");
      expect(revert.triggeringBatchIds.slice()).toEqual(["R1"]);
      expect(historyManager.completedHistoryEntryQueue.map(e => e.id)).toEqual([]);
      expect(historyManager.expectedRemoteHead).toBe("R1");
      expect(manager.undoStore.history.map(e => e.id)).not.toContain("L1");
    });
  });

  describe("uploadQueuedHistoryEntries — send-side fork", () => {
    it("aborts the upload transaction when metadata.lastHistoryEntry.id doesn't match expectedRemoteHead", async () => {
      // Simulate: our client believes the remote head is "r0", but
      // between queueing L1 and running the transaction, client B has
      // already uploaded R1 (so the metadata now reports R1 as head).
      getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
      const { manager, historyManager, firestoreCapture } = await setupManager({
        txMetadataLastHistoryEntry: { id: "R1", index: 1 },
      });
      expect(historyManager.expectedRemoteHead).toBe("r0");

      // Queue a local entry L1.
      const l1Snapshot = makeEntrySnapshot(
        "L1",
        "main",
        [{ op: "replace", path: "/items/1/color", value: "red" }],
        [{ op: "replace", path: "/items/1/color", value: "white" }],
      );
      const l1Entry = HistoryEntry.create(l1Snapshot);
      manager.addHistoryEntryAfterApplying(l1Entry);
      historyManager.completedHistoryEntryQueue.push(l1Entry);

      // Make environmentAndMetadataDocReadyPromise resolve immediately
      // so the transaction body actually runs.
      historyManager.environmentAndMetadataDocReadyPromise = Promise.resolve();

      // Invoke upload. Should detect the mismatch and NOT write the entry.
      await historyManager.uploadQueuedHistoryEntries();

      // Transaction.set should NOT have been called for L1 — the
      // upload is aborted because remote head differs from expected.
      expect(firestoreCapture.transactionSetCalls).toEqual([]);

      // L1 stays in the queue (receive-side rollback will remove it
      // when the listener eventually delivers R1).
      expect(historyManager.completedHistoryEntryQueue.map(e => e.id)).toEqual(["L1"]);

      // expectedRemoteHead is unchanged — only a successful upload
      // advances it on the send side.
      expect(historyManager.expectedRemoteHead).toBe("r0");
    });

    it("waits for getInitialLastHistoryEntry to seed expectedRemoteHead before the fork check", async () => {
      // Regression: if an upload is triggered before
      // getInitialLastHistoryEntry resolves, expectedRemoteHead is
      // still null, and any document with existing remote history
      // would spuriously throw RemoteHeadChangedError inside the
      // transaction.
      let resolveInit!: (v: any) => void;
      getLastHistoryEntry.mockImplementation(
        () => new Promise<any>(resolve => { resolveInit = resolve; })
      );

      // Inline setup — setupManager awaits init, which we specifically
      // want to leave pending here.
      const treeId = "main";
      const manager = TreeManager.create({ document: {}, undoStore: {} });
      const tree = ArrayTestTree.create({ key: treeId, uid: "test-user" });
      manager.setMainDocument(tree as any);
      const { firestore, capture } = makeFirestoreMock({
        txMetadataLastHistoryEntry: { id: "r0", index: 0 },
      });
      const historyManager = new FirestoreHistoryManagerConcurrent({
        firestore,
        userContextProvider: makeUserContextProviderMock(),
        treeManager: manager,
        uploadLocalHistory: true,
        syncRemoteHistory: false,
      });
      await historyManager.environmentAndMetadataDocReadyPromise;
      expect(historyManager.expectedRemoteHead).toBeNull();

      // Queue L1 and kick off the upload while init is still pending.
      const l1Snapshot = makeEntrySnapshot(
        "L1", "main",
        [{ op: "replace", path: "/items/0/color", value: "red" }],
        [{ op: "replace", path: "/items/0/color", value: "white" }],
      );
      const l1Entry = HistoryEntry.create(l1Snapshot);
      manager.addHistoryEntryAfterApplying(l1Entry);
      historyManager.completedHistoryEntryQueue.push(l1Entry);

      const uploadPromise = historyManager.uploadQueuedHistoryEntries();

      // Flush microtasks: the transaction must NOT have run yet.
      for (let i = 0; i < 10; i++) await Promise.resolve();
      expect(capture.transactionSetCalls).toEqual([]);
      expect(historyManager.expectedRemoteHead).toBeNull();

      // Resolve init — expectedRemoteHead seeds to "r0", matching the
      // mocked metadata head, so the transaction proceeds.
      resolveInit({ id: "r0", index: 0 });
      await uploadPromise;

      expect(capture.transactionSetCalls.length).toBe(1);
      expect(historyManager.completedHistoryEntryQueue.map(e => e.id)).toEqual([]);
      expect(historyManager.expectedRemoteHead).toBe("L1");
    });
  });

  describe("applyHistoryEntries — receive-side merge", () => {
    it("keeps a local entry when its scope is disjoint from the incoming remote entry's scope", async () => {
      // Seed expectedRemoteHead to "r0".
      getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
      const { manager, tree, historyManager } = await setupDocMergeManager();
      expect(historyManager.expectedRemoteHead).toBe("r0");

      // Prepare the tree with tiles A and B (these were presumed to
      // exist at the fork point "r0").
      applyPatch(tree, [
        { op: "add", path: "/content/tileMap/A", value: { id: "A", content: { value: "initial" } } },
        { op: "add", path: "/content/tileMap/B", value: { id: "B", content: { value: "initial" } } },
      ]);

      // Local entry L1: user A set tile A's value to "alpha".
      const l1Patches: IJsonPatch[] = [{ op: "replace", path: "/content/tileMap/A/content/value", value: "alpha" }];
      const l1Inverse: IJsonPatch[] = [{ op: "replace", path: "/content/tileMap/A/content/value", value: "initial" }];
      applyPatch(tree, l1Patches);
      const l1Snapshot = makeEntrySnapshot("L1", "main", l1Patches, l1Inverse);
      const l1Entry = HistoryEntry.create(l1Snapshot);
      manager.addHistoryEntryAfterApplying(l1Entry);
      historyManager.completedHistoryEntryQueue.push(l1Entry);

      expect(tree.content.tileMap.get("A")?.content.value).toBe("alpha");

      // Remote entry R1 from user B: set tile B's value to "beta".
      // previousEntryId = "r0", which matches expectedRemoteHead but
      // NOT our local head (L1) — forked.
      const r1Patches: IJsonPatch[] = [{ op: "replace", path: "/content/tileMap/B/content/value", value: "beta" }];
      const r1Inverse: IJsonPatch[] = [{ op: "replace", path: "/content/tileMap/B/content/value", value: "initial" }];
      const r1Snapshot = makeEntrySnapshot("R1", "main", r1Patches, r1Inverse);
      const r1wrap = makeWrapperDoc(1, "r0", r1Snapshot);

      await historyManager.applyHistoryEntries([r1wrap]);

      // Post-merge expectations:
      // 1. L1 NOT rolled back — tile A still holds "alpha".
      // 2. R1 applied on top — tile B now holds "beta".
      // 3. Local history order preserved: L1 stays in place, R1
      //    appended after it (spec section "History ordering").
      // 4. L1 remains in the upload queue — it still needs to be
      //    committed, now chaining off R1.
      // 5. expectedRemoteHead advanced to R1.
      expect(tree.content.tileMap.get("A")?.content.value).toBe("alpha");
      expect(tree.content.tileMap.get("B")?.content.value).toBe("beta");
      expect(manager.document.history.map(e => e.id)).toEqual(["L1", "R1"]);
      expect(historyManager.completedHistoryEntryQueue.map(e => e.id)).toEqual(["L1"]);
      expect(historyManager.expectedRemoteHead).toBe("R1");
    });

    it("rolls back from the first conflicting local entry onward, keeping earlier ones", async () => {
      getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
      const { manager, tree, historyManager } = await setupDocMergeManager();

      applyPatch(tree, [
        { op: "add", path: "/content/tileMap/A", value: { id: "A", content: { value: "initial" } } },
        { op: "add", path: "/content/tileMap/B", value: { id: "B", content: { value: "initial" } } },
      ]);

      // L1: tile A ("alpha"). L2: tile B ("beta-local"). L3: tile A ("alpha2").
      // Remote R1: tile B. Expectation: keep L1; roll back L2 and L3.
      const mkEntry = (id: string, tileId: string, value: string, prevValue: string) => {
        const patches: IJsonPatch[] = [{ op: "replace", path: `/content/tileMap/${tileId}/content/value`, value }];
        const inverse: IJsonPatch[] = [
          { op: "replace", path: `/content/tileMap/${tileId}/content/value`, value: prevValue },
        ];
        applyPatch(tree, patches);
        const snapshot = makeEntrySnapshot(id, "main", patches, inverse);
        const entry = HistoryEntry.create(snapshot);
        manager.addHistoryEntryAfterApplying(entry);
        historyManager.completedHistoryEntryQueue.push(entry);
        return entry;
      };

      mkEntry("L1", "A", "alpha", "initial");
      mkEntry("L2", "B", "beta-local", "initial");
      mkEntry("L3", "A", "alpha2", "alpha");

      expect(tree.content.tileMap.get("A")?.content.value).toBe("alpha2");
      expect(tree.content.tileMap.get("B")?.content.value).toBe("beta-local");

      const r1Snapshot = makeEntrySnapshot(
        "R1", "main",
        [{ op: "replace", path: "/content/tileMap/B/content/value", value: "beta-remote" }],
        [{ op: "replace", path: "/content/tileMap/B/content/value", value: "initial" }],
      );
      const r1wrap = makeWrapperDoc(1, "r0", r1Snapshot);

      await historyManager.applyHistoryEntries([r1wrap]);

      // L1 kept: tile A reverts to "alpha" (since L3 was rolled back).
      // L2 and L3 rolled back: tile B goes to "initial", then R1 sets it
      // to "beta-remote".
      expect(tree.content.tileMap.get("A")?.content.value).toBe("alpha");
      expect(tree.content.tileMap.get("B")?.content.value).toBe("beta-remote");
      // History: [L1, L2, L3, revert(L3), revert(L2), R1] — originals stay
      // in place, reverts appear in newest-first order, then R1.
      const ids = manager.document.history.map(e => e.id);
      expect(ids[0]).toBe("L1");
      expect(ids[1]).toBe("L2");
      expect(ids[2]).toBe("L3");
      expect(ids[ids.length - 1]).toBe("R1");
      expect(ids.length).toBe(6);
      const reverts = manager.document.history.filter(e => e.isRevert);
      expect(reverts.map(e => e.revertsEntryId)).toEqual(["L3", "L2"]);
      expect(reverts[0].triggeringBatchIds.slice()).toEqual(["R1"]);
      expect(reverts[1].triggeringBatchIds.slice()).toEqual(["R1"]);
      expect(historyManager.completedHistoryEntryQueue.map(e => e.id)).toEqual(["L1"]);
      expect(historyManager.expectedRemoteHead).toBe("R1");
      const undoIds = manager.undoStore.history.map(e => e.id);
      expect(undoIds).not.toContain("L2");
      expect(undoIds).not.toContain("L3");
    });

    it("falls back to full rollback when local and remote both touch the doc scope", async () => {
      getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
      const { manager, tree, historyManager } = await setupDocMergeManager();

      // Local entry L1 touches document-level state (docName).
      const l1Patches: IJsonPatch[] = [{ op: "replace", path: "/content/docName", value: "local-name" }];
      const l1Inverse: IJsonPatch[] = [{ op: "replace", path: "/content/docName", value: "" }];
      applyPatch(tree, l1Patches);
      const l1Snapshot = makeEntrySnapshot("L1", "main", l1Patches, l1Inverse);
      const l1Entry = HistoryEntry.create(l1Snapshot);
      manager.addHistoryEntryAfterApplying(l1Entry);
      historyManager.completedHistoryEntryQueue.push(l1Entry);

      // Remote R1 also touches doc-level state (different field still
      // maps to doc scope).
      const r1Snapshot = makeEntrySnapshot(
        "R1", "main",
        [{ op: "replace", path: "/content/docName", value: "remote-name" }],
        [{ op: "replace", path: "/content/docName", value: "" }],
      );
      const r1wrap = makeWrapperDoc(1, "r0", r1Snapshot);

      await historyManager.applyHistoryEntries([r1wrap]);

      // L1 rolled back; R1 applied. History: [L1, revert(L1), R1].
      expect(tree.content.docName).toBe("remote-name");
      const ids = manager.document.history.map(e => e.id);
      expect(ids[0]).toBe("L1");
      expect(ids[ids.length - 1]).toBe("R1");
      expect(ids.length).toBe(3);
      expect(manager.document.history[1].isRevert).toBe(true);
      expect(manager.document.history[1].revertsEntryId).toBe("L1");
      expect(historyManager.completedHistoryEntryQueue.map(e => e.id)).toEqual([]);
      expect(historyManager.expectedRemoteHead).toBe("R1");
      expect(manager.undoStore.history.map(e => e.id)).not.toContain("L1");
    });

    it("runs fork detection on a subsequent batch when the queue is non-empty", async () => {
      // Script-5 regression. Under the old early-return, a non-conflicting
      // batch 1 would update the local head to the remote tail, and then
      // batch 2 would short-circuit the fork check — missing a scope
      // conflict with pending local entries.
      getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
      const { manager, tree, historyManager } = await setupDocMergeManager();

      applyPatch(tree, [
        { op: "add", path: "/content/tileMap/A", value: { id: "A", content: { value: "initial" } } },
        { op: "add", path: "/content/tileMap/B", value: { id: "B", content: { value: "initial" } } },
      ]);

      // Local L1 edits tile A (scope tile:A).
      const l1Patches: IJsonPatch[] = [
        { op: "replace", path: "/content/tileMap/A/content/value", value: "local-A" }
      ];
      const l1Inverse: IJsonPatch[] = [
        { op: "replace", path: "/content/tileMap/A/content/value", value: "initial" }
      ];
      applyPatch(tree, l1Patches);
      const l1Entry = HistoryEntry.create(makeEntrySnapshot("L1", "main", l1Patches, l1Inverse));
      manager.addHistoryEntryAfterApplying(l1Entry);
      historyManager.completedHistoryEntryQueue.push(l1Entry);

      // Batch 1: remote R1 on tile B (disjoint from L1).
      const r1Snapshot = makeEntrySnapshot(
        "R1", "main",
        [{ op: "replace", path: "/content/tileMap/B/content/value", value: "remote-B" }],
        [{ op: "replace", path: "/content/tileMap/B/content/value", value: "initial" }],
      );
      await historyManager.applyHistoryEntries([makeWrapperDoc(1, "r0", r1Snapshot)]);

      // Sanity check batch 1 state.
      expect(historyManager.expectedRemoteHead).toBe("R1");
      expect(historyManager.completedHistoryEntryQueue.map(e => e.id)).toEqual(["L1"]);
      expect(manager.document.history.map(e => e.id)).toEqual(["L1", "R1"]);

      // Batch 2: remote R2 on tile A (CONFLICTS with pending L1).
      // Its previousEntryId is R1 — matches local head — so the old
      // implementation would short-circuit fork detection here.
      const r2Snapshot = makeEntrySnapshot(
        "R2", "main",
        [{ op: "replace", path: "/content/tileMap/A/content/value", value: "remote-A" }],
        [{ op: "replace", path: "/content/tileMap/A/content/value", value: "local-A" }],
      );
      await historyManager.applyHistoryEntries([makeWrapperDoc(2, "R1", r2Snapshot)]);

      // L1 must now be rolled back. Tree reflects remote-A (not local-A).
      expect(tree.content.tileMap.get("A")?.content.value).toBe("remote-A");
      expect(tree.content.tileMap.get("B")?.content.value).toBe("remote-B");

      // Queue drained; expectedRemoteHead at R2.
      expect(historyManager.completedHistoryEntryQueue.map(e => e.id)).toEqual([]);
      expect(historyManager.expectedRemoteHead).toBe("R2");

      // History: [L1, R1, revert(L1), R2]. L1 still present; revert
      // entry references L1 and carries R2 as the triggering id.
      const ids = manager.document.history.map(e => e.id);
      expect(ids[0]).toBe("L1");
      expect(ids[1]).toBe("R1");
      expect(ids[ids.length - 1]).toBe("R2");
      expect(ids.length).toBe(4);
      const revert = manager.document.history[2];
      expect(revert.isRevert).toBe(true);
      expect(revert.revertsEntryId).toBe("L1");
      expect(revert.triggeringBatchIds.slice()).toEqual(["R2"]);
    });

    it("does not rollback when the upload queue is empty, even if previousEntryId mismatches", async () => {
      // The empty-queue guard in detectAndResolveFork short-circuits before
      // partitionLocalEntriesForMerge runs. Even though R1's previousEntryId
      // does not match expectedRemoteHead ("r0"), there are no pending local
      // entries to roll back, so the remote entry is applied normally.
      getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
      const { manager, tree, historyManager } = await setupDocMergeManager();
      expect(historyManager.expectedRemoteHead).toBe("r0");

      applyPatch(tree, [
        { op: "add", path: "/content/tileMap/A", value: { id: "A", content: { value: "initial" } } },
      ]);

      // Queue is empty — no pending local entries.
      expect(historyManager.completedHistoryEntryQueue.length).toBe(0);

      // Incoming batch references a previousEntryId that does NOT match expectedRemoteHead.
      // ("some-other-id" !== "r0"). With no queue entries the empty-queue guard fires and
      // no rollback is attempted.
      const rSnapshot = makeEntrySnapshot(
        "R1", "main",
        [{ op: "replace", path: "/content/tileMap/A/content/value", value: "remote-A" }],
        [{ op: "replace", path: "/content/tileMap/A/content/value", value: "initial" }],
      );
      await historyManager.applyHistoryEntries([makeWrapperDoc(1, "some-other-id", rSnapshot)]);

      // Remote applied normally. No revert entries appended.
      expect(tree.content.tileMap.get("A")?.content.value).toBe("remote-A");
      expect(manager.document.history.map(e => e.id)).toEqual(["R1"]);
      expect(manager.document.history.filter(e => e.isRevert)).toEqual([]);
      expect(historyManager.expectedRemoteHead).toBe("R1");
    });
  });

  describe("applyHistoryEntries — upload retrigger after merge", () => {
    it("uploads the surviving local entry with the new remote head as previousEntryId", async () => {
      getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
      const { manager, tree, historyManager, firestoreCapture } = await setupDocMergeManager({
        // The transaction sees R1 as the head, matching expectedRemoteHead
        // after the merge advances it.
        txMetadataLastHistoryEntry: { id: "R1", index: 1 },
      });

      applyPatch(tree, [
        { op: "add", path: "/content/tileMap/A", value: { id: "A", content: { value: "initial" } } },
        { op: "add", path: "/content/tileMap/B", value: { id: "B", content: { value: "initial" } } },
      ]);

      // Queue local L1 on tile A.
      const l1Patches: IJsonPatch[] = [{ op: "replace", path: "/content/tileMap/A/content/value", value: "alpha" }];
      const l1Inverse: IJsonPatch[] = [{ op: "replace", path: "/content/tileMap/A/content/value", value: "initial" }];
      applyPatch(tree, l1Patches);
      const l1Snapshot = makeEntrySnapshot("L1", "main", l1Patches, l1Inverse);
      const l1Entry = HistoryEntry.create(l1Snapshot);
      manager.addHistoryEntryAfterApplying(l1Entry);
      historyManager.completedHistoryEntryQueue.push(l1Entry);

      // Make environmentAndMetadataDocReadyPromise resolve immediately
      // so the transaction body actually runs inside the retrigger.
      historyManager.environmentAndMetadataDocReadyPromise = Promise.resolve();

      // Incoming R1 on tile B, forked off "r0".
      const r1Snapshot = makeEntrySnapshot(
        "R1", "main",
        [{ op: "replace", path: "/content/tileMap/B/content/value", value: "beta" }],
        [{ op: "replace", path: "/content/tileMap/B/content/value", value: "initial" }],
      );
      const r1wrap = makeWrapperDoc(1, "r0", r1Snapshot);

      await historyManager.applyHistoryEntries([r1wrap]);
      // Flush microtasks so the retriggered upload can run.
      for (let i = 0; i < 10; i++) await Promise.resolve();

      // L1 was uploaded by the retrigger:
      // - its transaction.set call carries previousEntryId = "R1"
      // - completedHistoryEntryQueue is drained
      // - expectedRemoteHead is now L1
      expect(firestoreCapture.transactionSetCalls.length).toBe(1);
      expect(firestoreCapture.transactionSetCalls[0].data.previousEntryId).toBe("R1");
      expect(historyManager.completedHistoryEntryQueue.map(e => e.id)).toEqual([]);
      expect(historyManager.expectedRemoteHead).toBe("L1");
    });
  });

  describe("applyHistoryEntries — serialization", () => {
    it("waits for a prior applyHistoryEntries call to finish before starting the next", async () => {
      const { tree, historyManager } = await setupManager();
      tree.setItems([Item.create({ id: "a" })]);

      // Intercept tree.applyPatchesFromManager so we can block the
      // first invocation and observe when the second one would start.
      const patchCalls: number[] = [];
      let releaseFirstApply!: () => void;
      const firstApplyGate = new Promise<void>(resolve => {
        releaseFirstApply = resolve;
      });
      const originalApply = tree.applyPatchesFromManager;
      tree.applyPatchesFromManager = jest.fn(async (h, e, patches) => {
        const callIndex = patchCalls.length;
        patchCalls.push(callIndex);
        if (callIndex === 0) {
          await firstApplyGate;
        }
        return originalApply.call(tree, h, e, patches);
      }) as any;

      const e1 = makeEntrySnapshot(
        "E1", "main",
        [{ op: "replace", path: "/items/0/color", value: "red" }],
        [{ op: "replace", path: "/items/0/color", value: "white" }],
      );
      const e2 = makeEntrySnapshot(
        "E2", "main",
        [{ op: "replace", path: "/items/0/color", value: "blue" }],
        [{ op: "replace", path: "/items/0/color", value: "red" }],
      );

      // Kick off two applies concurrently.
      const p1 = historyManager.applyHistoryEntries([makeWrapperDoc(0, undefined, e1)]);
      const p2 = historyManager.applyHistoryEntries([makeWrapperDoc(1, "E1", e2)]);

      // Flush a few microtasks so p1 has a chance to reach applyPatchesFromManager.
      for (let i = 0; i < 10; i++) await Promise.resolve();

      // Only the first apply should have reached the tree.
      expect(patchCalls).toEqual([0]);

      // Release p1 — p2 should then start.
      releaseFirstApply();
      await p1;
      await p2;

      expect(patchCalls).toEqual([0, 1]);
      expect(tree.items[0].color).toBe("blue");
    });

    it("does not stall subsequent apply calls when a prior one rejects", async () => {
      const { tree, historyManager } = await setupManager();
      tree.setItems([Item.create({ id: "a" })]);

      let shouldFail = true;
      const originalApply = tree.applyPatchesFromManager;
      tree.applyPatchesFromManager = jest.fn(async (h, e, patches) => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error("boom");
        }
        return originalApply.call(tree, h, e, patches);
      }) as any;

      const e1 = makeEntrySnapshot(
        "E1", "main",
        [{ op: "replace", path: "/items/0/color", value: "red" }],
        [{ op: "replace", path: "/items/0/color", value: "white" }],
      );
      const e2 = makeEntrySnapshot(
        "E2", "main",
        [{ op: "replace", path: "/items/0/color", value: "green" }],
        [{ op: "replace", path: "/items/0/color", value: "white" }],
      );

      // First call rejects.
      await expect(
        historyManager.applyHistoryEntries([makeWrapperDoc(0, undefined, e1)])
      ).rejects.toThrow("boom");

      // Second call should still run and succeed.
      await historyManager.applyHistoryEntries([makeWrapperDoc(1, undefined, e2)]);
      expect(tree.items[0].color).toBe("green");
    });
  });
});
