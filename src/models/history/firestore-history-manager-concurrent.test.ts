import { reaction, when } from "mobx";
import { applyPatch, IJsonPatch, Instance, types } from "mobx-state-tree";
import { Firestore } from "../../lib/firestore";
import { UserContextProvider } from "../stores/user-context-provider";
import { TreeManager } from "./tree-manager";
import { HistoryEntry, HistoryEntrySnapshot } from "./history";
import { IFirestoreHistoryEntryDoc, getLastHistoryEntry as _getLastHistoryEntry } from "./history-firestore";
import { FirestoreHistoryManagerConcurrent } from "./firestore-history-manager-concurrent";
import { IFirestoreHistoryManagerArgs } from "./firestore-history-manager";
import { ICommittedEntry } from "./history-commits";

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
  // When given, each transaction waits for it before running its body.
  transactionGate?: Promise<void>;
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
      await opts.transactionGate;
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
async function setupManager(firestoreOpts: FirestoreMockOptions = {},
                            managerArgs: Partial<IFirestoreHistoryManagerArgs> = {}) {
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
    ...managerArgs,
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
  return { id: entry.id ?? `e${index}`, index, previousEntryId, entry };
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
      manager.undoStore.addHistoryEntry(l1Entry);

      // Sanity: local state currently reflects A's edit.
      expect(tree.items[1].color).toBe("red");
      expect(manager.undoStore.history.map(e => e.id)).toEqual(["L1"]);

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
        manager.undoStore.addHistoryEntry(entry);
        return entry;
      };

      mkEntry("L1", "A", "alpha", "initial");
      mkEntry("L2", "B", "beta-local", "initial");
      mkEntry("L3", "A", "alpha2", "alpha");

      expect(tree.content.tileMap.get("A")?.content.value).toBe("alpha2");
      expect(tree.content.tileMap.get("B")?.content.value).toBe("beta-local");
      expect(manager.undoStore.history.map(e => e.id)).toEqual(["L1", "L2", "L3"]);

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
      expect(undoIds).toContain("L1");
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
      manager.undoStore.addHistoryEntry(l1Entry);

      expect(manager.undoStore.history.map(e => e.id)).toEqual(["L1"]);

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
      // Documents the empty-queue end state for detectAndResolveFork: when
      // there are no pending local entries, an incoming batch is applied
      // normally regardless of previousEntryId. NOTE: this test does not
      // uniquely verify the early-return guard itself — partitionLocalEntriesForMerge
      // also returns rollbackCount: 0 for an empty local array, so removing
      // the guard would not break this test. The guard is an optimization;
      // this test pins the behavior the guard exists to enable.
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

    it("scope-checks the union of a multi-wrapper batch against pending local entries", async () => {
      // Single batch with two wrappers where only the second wrapper conflicts
      // with a pending local entry. Verifies that partitionLocalEntriesForMerge
      // is fed the full incoming batch (so the scope union picks up the
      // conflict) and that triggeringBatchIds carries every id in the batch.
      // entry-scopes.test.ts covers the union logic in isolation; this test
      // pins the integration through detectAndResolveFork.
      getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
      const { manager, tree, historyManager } = await setupDocMergeManager();

      applyPatch(tree, [
        { op: "add", path: "/content/tileMap/A", value: { id: "A", content: { value: "initial" } } },
        { op: "add", path: "/content/tileMap/B", value: { id: "B", content: { value: "initial" } } },
        { op: "add", path: "/content/tileMap/C", value: { id: "C", content: { value: "initial" } } },
      ]);

      // Local L1 on tile A, L2 on tile B. Both queued, both in undo store.
      const mkLocal = (id: string, tileId: string, value: string) => {
        const patches: IJsonPatch[] = [
          { op: "replace", path: `/content/tileMap/${tileId}/content/value`, value }
        ];
        const inverse: IJsonPatch[] = [
          { op: "replace", path: `/content/tileMap/${tileId}/content/value`, value: "initial" }
        ];
        applyPatch(tree, patches);
        const entry = HistoryEntry.create(makeEntrySnapshot(id, "main", patches, inverse));
        manager.addHistoryEntryAfterApplying(entry);
        historyManager.completedHistoryEntryQueue.push(entry);
        manager.undoStore.addHistoryEntry(entry);
        return entry;
      };

      mkLocal("L1", "A", "local-A");
      mkLocal("L2", "B", "local-B");

      expect(manager.undoStore.history.map(e => e.id)).toEqual(["L1", "L2"]);

      // Single incoming batch: [R1 on tile C (disjoint), R2 on tile A (conflicts with L1)].
      // R1.previousEntryId = "r0"; R2.previousEntryId = "R1". Scope union of the
      // batch is { tile:C, tile:A }, so L1 should conflict and trigger rollback
      // of L1 and L2.
      const r1Snapshot = makeEntrySnapshot(
        "R1", "main",
        [{ op: "replace", path: "/content/tileMap/C/content/value", value: "remote-C" }],
        [{ op: "replace", path: "/content/tileMap/C/content/value", value: "initial" }],
      );
      const r2Snapshot = makeEntrySnapshot(
        "R2", "main",
        [{ op: "replace", path: "/content/tileMap/A/content/value", value: "remote-A" }],
        [{ op: "replace", path: "/content/tileMap/A/content/value", value: "local-A" }],
      );

      await historyManager.applyHistoryEntries([
        makeWrapperDoc(1, "r0", r1Snapshot),
        makeWrapperDoc(2, "R1", r2Snapshot),
      ]);

      // Tree state: L1 and L2 reverted, both remote entries applied.
      expect(tree.content.tileMap.get("A")?.content.value).toBe("remote-A");
      expect(tree.content.tileMap.get("B")?.content.value).toBe("initial");
      expect(tree.content.tileMap.get("C")?.content.value).toBe("remote-C");

      // History: [L1, L2, revert(L2), revert(L1), R1, R2].
      const history = manager.document.history;
      expect(history.map(e => e.id)).toHaveLength(6);
      expect(history[0].id).toBe("L1");
      expect(history[1].id).toBe("L2");
      expect(history[2].isRevert).toBe(true);
      expect(history[2].revertsEntryId).toBe("L2");
      expect(history[3].isRevert).toBe(true);
      expect(history[3].revertsEntryId).toBe("L1");
      expect(history[4].id).toBe("R1");
      expect(history[5].id).toBe("R2");

      // Both wrappers in the batch should appear in triggeringBatchIds on
      // each revert.
      expect(history[2].triggeringBatchIds.slice()).toEqual(["R1", "R2"]);
      expect(history[3].triggeringBatchIds.slice()).toEqual(["R1", "R2"]);

      // Queue and undo store cleaned of the rolled-back originals.
      expect(historyManager.completedHistoryEntryQueue.map(e => e.id)).toEqual([]);
      expect(manager.undoStore.history.map(e => e.id)).not.toContain("L1");
      expect(manager.undoStore.history.map(e => e.id)).not.toContain("L2");

      // expectedRemoteHead advances to the last wrapper in the batch.
      expect(historyManager.expectedRemoteHead).toBe("R2");
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

  describe("uploadQueuedHistoryEntries — uid stamping", () => {
    it("stamps the uploading user's uid into each entry's serialized snapshot", async () => {
      const { manager, historyManager, firestoreCapture } = await setupManager();

      const entrySnapshot = makeEntrySnapshot(
        "L1",
        "main",
        [{ op: "replace", path: "/items/0/color", value: "red" }],
        [{ op: "replace", path: "/items/0/color", value: "white" }],
      );
      const entry = HistoryEntry.create(entrySnapshot);
      manager.addHistoryEntryAfterApplying(entry);
      historyManager.completedHistoryEntryQueue.push(entry);
      historyManager.environmentAndMetadataDocReadyPromise = Promise.resolve();

      await historyManager.uploadQueuedHistoryEntries();

      expect(firestoreCapture.transactionSetCalls).toHaveLength(1);
      const writtenEntry = JSON.parse(firestoreCapture.transactionSetCalls[0].data.entry);
      expect(writtenEntry.uid).toBe("test-user");
      expect(writtenEntry.id).toBe("L1");
    });
  });

  describe("resumeUploadsAfterDelay — countdown", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("ticks the countdown once per second and resumes when it reaches zero", async () => {
      const { historyManager } = await setupManager();
      // Clear the orphan 5s metadata-doc fallback timer scheduled in
      // FirestoreHistoryManager.waitForMetadataDocument; the synchronous
      // onSnapshot mock resolves the wait but doesn't clear the timer.
      jest.clearAllTimers();

      historyManager.pauseUploads();
      expect(historyManager.paused).toBe(true);
      expect(historyManager.resumeCountdownSeconds).toBe(null);

      historyManager.resumeUploadsAfterDelay(5000);
      expect(historyManager.resumeCountdownSeconds).toBe(5);
      expect(historyManager.paused).toBe(true);

      jest.advanceTimersByTime(1000);
      expect(historyManager.resumeCountdownSeconds).toBe(4);
      expect(historyManager.paused).toBe(true);

      jest.advanceTimersByTime(2000);
      expect(historyManager.resumeCountdownSeconds).toBe(2);
      expect(historyManager.paused).toBe(true);

      jest.advanceTimersByTime(2000);
      expect(historyManager.resumeCountdownSeconds).toBe(null);
      expect(historyManager.paused).toBe(false);

      // No further ticks scheduled — countdown is one-shot.
      const sentinelBefore = historyManager.resumeCountdownSeconds;
      jest.advanceTimersByTime(5000);
      expect(historyManager.resumeCountdownSeconds).toBe(sentinelBefore);
    });

    it("ignores re-entrant calls while a countdown is in progress", async () => {
      const { historyManager } = await setupManager();
      jest.clearAllTimers();

      historyManager.pauseUploads();
      historyManager.resumeUploadsAfterDelay(5000);
      expect(historyManager.resumeCountdownSeconds).toBe(5);

      jest.advanceTimersByTime(1000);
      expect(historyManager.resumeCountdownSeconds).toBe(4);

      // Re-call mid-countdown — should be a no-op, not restart the timer.
      historyManager.resumeUploadsAfterDelay(10000);
      expect(historyManager.resumeCountdownSeconds).toBe(4);
    });
  });
  describe("onLocalEntryUploaded", () => {
    const queueEntry = (manager: Instance<typeof TreeManager>, historyManager: FirestoreHistoryManagerConcurrent,
                        id: string) => {
      const entry = HistoryEntry.create(makeEntrySnapshot(
        id,
        "main",
        [{ op: "replace", path: "/items/1/color", value: "red" }],
        [{ op: "replace", path: "/items/1/color", value: "white" }],
      ));
      manager.addHistoryEntryAfterApplying(entry);
      historyManager.completedHistoryEntryQueue.push(entry);
      return entry;
    };

    it("reports each entry of a committed transaction, in order", async () => {
      getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
      const { manager, historyManager, firestoreCapture } = await setupManager({
        txMetadataLastHistoryEntry: { id: "r0", index: 0 },
      });
      const onLocalEntryUploaded = jest.fn();
      historyManager.onLocalEntryUploaded = onLocalEntryUploaded;
      queueEntry(manager, historyManager, "L1");
      queueEntry(manager, historyManager, "L2");
      historyManager.environmentAndMetadataDocReadyPromise = Promise.resolve();

      await historyManager.uploadQueuedHistoryEntries();

      expect(firestoreCapture.transactionSetCalls).toHaveLength(2);
      expect(onLocalEntryUploaded.mock.calls.map(([entry]) => entry.id)).toEqual(["L1", "L2"]);
    });

    it("reports nothing when the transaction is aborted by a moved head", async () => {
      getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
      const { manager, historyManager } = await setupManager({
        txMetadataLastHistoryEntry: { id: "R1", index: 1 },
      });
      const onLocalEntryUploaded = jest.fn();
      historyManager.onLocalEntryUploaded = onLocalEntryUploaded;
      queueEntry(manager, historyManager, "L1");
      historyManager.environmentAndMetadataDocReadyPromise = Promise.resolve();

      await historyManager.uploadQueuedHistoryEntries();

      expect(historyManager.completedHistoryEntryQueue.map(e => e.id)).toEqual(["L1"]);
      expect(onLocalEntryUploaded).not.toHaveBeenCalled();
    });

    it("reports nothing for an entry rolled back before upload", async () => {
      getLastHistoryEntry.mockResolvedValue(undefined);
      const { manager, tree, historyManager, firestoreCapture } = await setupManager();
      const onLocalEntryUploaded = jest.fn();
      historyManager.onLocalEntryUploaded = onLocalEntryUploaded;
      tree.setItems([Item.create({ id: "a" }), Item.create({ id: "b" })]);
      applyPatch(tree, { op: "replace", path: "/items/1/color", value: "red" });
      queueEntry(manager, historyManager, "L1");

      await historyManager.rollbackLocalEntries(1, []);
      historyManager.environmentAndMetadataDocReadyPromise = Promise.resolve();
      await historyManager.uploadQueuedHistoryEntries();

      expect(tree.items[1].color).toBe("white");
      expect(historyManager.completedHistoryEntryQueue).toHaveLength(0);
      expect(firestoreCapture.transactionSetCalls).toEqual([]);
      expect(onLocalEntryUploaded).not.toHaveBeenCalled();
    });
  });

  describe("commits, voids and the settled state", () => {
    const flushMicrotasks = async () => {
      for (let i = 0; i < 10; i++) await Promise.resolve();
    };
    const colorEntry = (id: string, color: string, previousColor: string) => makeEntrySnapshot(
      id,
      "main",
      [{ op: "replace", path: "/items/0/color", value: color }],
      [{ op: "replace", path: "/items/0/color", value: previousColor }],
    );
    const queueEntry = (manager: Instance<typeof TreeManager>, historyManager: FirestoreHistoryManagerConcurrent,
                        id: string) => {
      const entry = HistoryEntry.create(colorEntry(id, "red", "white"));
      manager.addHistoryEntryAfterApplying(entry);
      historyManager.completedHistoryEntryQueue.push(entry);
      return entry;
    };
    const makeListener = () => ({ onCommitted: jest.fn(), onUncommittedVoided: jest.fn() });

    it("reports each entry of a committed transaction with its Firestore index", async () => {
      getLastHistoryEntry.mockResolvedValue({ id: "r4", index: 4 });
      const { manager, historyManager } = await setupManager({
        txMetadataLastHistoryEntry: { id: "r4", index: 4 },
      });
      expect(historyManager.expectedRemoteHeadIndex).toBe(4);
      const listener = makeListener();
      historyManager.addCommitListener(listener);
      queueEntry(manager, historyManager, "L1");
      queueEntry(manager, historyManager, "L2");

      await historyManager.uploadQueuedHistoryEntries();

      const committed: ICommittedEntry[] = [{ id: "L1", index: 5 }, { id: "L2", index: 6 }];
      expect(listener.onCommitted.mock.calls).toEqual([[committed]]);
      expect(historyManager.lastCommitted).toEqual({ id: "L2", index: 6 });
      expect(historyManager.expectedRemoteHead).toBe("L2");
      expect(historyManager.expectedRemoteHeadIndex).toBe(6);
    });

    it("reports nothing committed when the transaction is aborted by a moved head", async () => {
      getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
      const { manager, historyManager } = await setupManager({
        txMetadataLastHistoryEntry: { id: "R1", index: 1 },
      });
      const listener = makeListener();
      historyManager.addCommitListener(listener);
      queueEntry(manager, historyManager, "L1");

      await historyManager.uploadQueuedHistoryEntries();

      expect(listener.onCommitted).not.toHaveBeenCalled();
      expect(historyManager.lastCommitted).toBeUndefined();
      expect(historyManager.expectedRemoteHead).toBe("r0");
      expect(historyManager.expectedRemoteHeadIndex).toBe(0);
    });

    it("voids uncommitted snapshots before applying a remote entry", async () => {
      getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
      const { manager, tree, historyManager } = await setupManager();
      tree.setItems([Item.create({ id: "a" }), Item.create({ id: "b" })]);
      applyPatch(tree, { op: "replace", path: "/items/0/color", value: "red" });
      queueEntry(manager, historyManager, "L1");

      const events: string[] = [];
      historyManager.addCommitListener({
        onCommitted: () => events.push("committed"),
        onUncommittedVoided: reason => events.push(`voided: ${reason}`),
      });
      const originalApply = tree.applyPatchesFromManager;
      tree.applyPatchesFromManager = jest.fn((h, e, patches) => {
        events.push("patches");
        return originalApply.call(tree, h, e, patches);
      }) as any;

      // R1 conflicts with L1, so L1 is rolled back before R1 is applied.
      const r1wrap = makeWrapperDoc(1, "r0", makeEntrySnapshot(
        "R1", "main",
        [{ op: "remove", path: "/items/0" }],
        [{ op: "add", path: "/items/0", value: { id: "a", color: "white" } }],
      ));
      await historyManager.applyHistoryEntries([r1wrap]);

      expect(events).toEqual(["voided: remote-entry", "patches", "patches"]);
      expect(historyManager.expectedRemoteHead).toBe("R1");
      expect(historyManager.expectedRemoteHeadIndex).toBe(1);

      // A delivery with nothing new voids nothing.
      await historyManager.applyHistoryEntries([r1wrap]);
      expect(events).toEqual(["voided: remote-entry", "patches", "patches"]);
    });

    it("is settled only with an empty queue, no upload, no apply, and nothing buffered", async () => {
      let releaseTransaction!: () => void;
      const transactionGate = new Promise<void>(resolve => { releaseTransaction = resolve; });
      const { manager, tree, historyManager } = await setupManager({ transactionGate });
      tree.setItems([Item.create({ id: "a" })]);
      const settledValues: boolean[] = [];
      const dispose = reaction(() => historyManager.isHistorySettled, settled => settledValues.push(settled));
      expect(historyManager.isHistorySettled).toBe(true);

      // A local entry waiting on its upload transaction.
      const l1 = HistoryEntry.create(colorEntry("L1", "red", "white"));
      manager.addHistoryEntryAfterApplying(l1);
      historyManager.onHistoryEntryCompleted(manager.document, l1, 0);
      await flushMicrotasks();
      expect(historyManager.uploadInProgress).toBe(true);
      expect(settledValues).toEqual([false]);
      releaseTransaction();
      await when(() => historyManager.isHistorySettled);
      expect(historyManager.completedHistoryEntryQueue).toHaveLength(0);
      expect(settledValues).toEqual([false, true]);

      // A remote entry being applied.
      let releaseApply!: () => void;
      const applyGate = new Promise<void>(resolve => { releaseApply = resolve; });
      const originalApply = tree.applyPatchesFromManager;
      tree.applyPatchesFromManager = jest.fn(async (h, e, patches) => {
        await applyGate;
        return originalApply.call(tree, h, e, patches);
      }) as any;
      const applied = historyManager.applyHistoryEntries([makeWrapperDoc(1, "L1", colorEntry("R1", "blue", "red"))]);
      await flushMicrotasks();
      expect(historyManager.applying).toBe(true);
      expect(historyManager.isHistorySettled).toBe(false);
      releaseApply();
      await applied;
      expect(historyManager.isHistorySettled).toBe(true);
      expect(settledValues).toEqual([false, true, false, true]);

      // A delivery buffered while downloads are paused.
      historyManager.pauseDownloads();
      historyManager.syncRemoteFirestoreHistory([makeWrapperDoc(2, "R1", colorEntry("R2", "green", "blue"))]);
      expect(historyManager.isHistorySettled).toBe(false);
      historyManager.resumeDownloads();
      await historyManager.applyInProgress;
      expect(historyManager.isHistorySettled).toBe(true);
      expect(tree.items[0].color).toBe("green");
      dispose();
    });
  });

  describe("initial load", () => {
    const colorEntry = (id: string, color: string) => makeEntrySnapshot(
      id,
      "main",
      [{ op: "replace", path: "/items/0/color", value: color }],
      [{ op: "replace", path: "/items/0/color", value: "white" }],
    );
    const flushApplies = async (historyManager: FirestoreHistoryManagerConcurrent) => {
      await historyManager.applyInProgress;
      for (let i = 0; i < 10; i++) await Promise.resolve();
    };

    it("starts from a settled envelope's id without querying Firestore for the last entry", async () => {
      const { manager, tree, historyManager } = await setupManager({}, {
        savedEnvelope: { lastHistoryEntryId: "e5", lastHistoryEntryIndex: 5, settled: true, exactSince: "e2" },
      });
      expect(getLastHistoryEntry).not.toHaveBeenCalled();
      expect(historyManager.expectedRemoteHead).toBe("e5");
      expect(historyManager.expectedRemoteHeadIndex).toBe(5);
      expect(manager.exactness.exactSince).toBe("e2");

      // The content as saved at e5.
      tree.setItems([Item.create({ id: "a", color: "e5" })]);
      await historyManager.applyHistoryEntries([
        makeWrapperDoc(4, "e3", colorEntry("e4", "e4")),
        makeWrapperDoc(5, "e4", colorEntry("e5", "e5")),
        makeWrapperDoc(6, "e5", colorEntry("e6", "e6")),
      ]);

      expect(manager.document.history.map(e => e.id)).toEqual(["e6"]);
      expect(tree.items[0].color).toBe("e6");
      expect(historyManager.expectedRemoteHead).toBe("e6");
      expect(historyManager.expectedRemoteHeadIndex).toBe(6);
    });

    it("skips entries up to a settled envelope's index when its id isn't in the history", async () => {
      const { manager, tree, historyManager } = await setupManager({}, {
        savedEnvelope: { lastHistoryEntryId: "e5", lastHistoryEntryIndex: 5, settled: true, exactSince: "e2" },
      });
      tree.setItems([Item.create({ id: "a", color: "e5" })]);

      // Another entry sits at e5's index.
      await historyManager.applyHistoryEntries([
        makeWrapperDoc(4, "e3", colorEntry("e4", "e4")),
        makeWrapperDoc(5, "e4", colorEntry("x5", "x5")),
        makeWrapperDoc(6, "x5", colorEntry("e6", "e6")),
      ]);

      expect(manager.document.history.map(e => e.id)).toEqual(["e6"]);
      expect(tree.items[0].color).toBe("e6");
      expect(manager.exactness.isExact).toBe(false);
      expect(manager.exactness.notExactReason).toBe("saved-id-missing");
    });

    it("keeps querying Firestore for the last entry when the envelope isn't settled", async () => {
      getLastHistoryEntry.mockResolvedValue({ id: "e7", index: 7 });
      const { manager, historyManager } = await setupManager({}, {
        savedEnvelope: { lastHistoryEntryId: "e5", lastHistoryEntryIndex: 5, settled: false },
      });
      expect(getLastHistoryEntry).toHaveBeenCalledTimes(1);
      expect(historyManager.expectedRemoteHead).toBe("e7");
      expect(historyManager.expectedRemoteHeadIndex).toBe(7);
      expect(manager.exactness.exactSince).toBe("e7");
    });

    it("leaves the session not exact when the initial apply fails", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const { manager, tree, historyManager } = await setupManager();
      tree.setItems([Item.create({ id: "a" })]);
      tree.applyPatchesFromManager = jest.fn(async () => { throw new Error("boom"); }) as any;

      historyManager.syncRemoteFirestoreHistory([makeWrapperDoc(0, undefined, colorEntry("e0", "red"))]);
      await flushApplies(historyManager);

      expect(manager.exactness.isExact).toBe(false);
      expect(manager.exactness.notExactReason).toBe("initial-apply-failed");
      expect(consoleError).toHaveBeenCalledWith("Could not apply remote history entries", expect.any(Error));
      expect(historyManager.applying).toBe(false);
      expect(historyManager.isHistorySettled).toBe(true);
      consoleError.mockRestore();
    });

    it("leaves the session not exact when a later apply fails", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const { manager, tree, historyManager } = await setupManager();
      tree.setItems([Item.create({ id: "a" })]);

      historyManager.syncRemoteFirestoreHistory([makeWrapperDoc(0, undefined, colorEntry("e0", "red"))]);
      await flushApplies(historyManager);
      expect(manager.exactness.isExact).toBe(true);
      tree.applyPatchesFromManager = jest.fn(async () => { throw new Error("boom"); }) as any;
      historyManager.syncRemoteFirestoreHistory([
        makeWrapperDoc(0, undefined, colorEntry("e0", "red")),
        makeWrapperDoc(1, "e0", colorEntry("e1", "blue")),
      ]);
      await flushApplies(historyManager);

      expect(manager.exactness.isExact).toBe(false);
      expect(manager.exactness.notExactReason).toBe("remote-apply-failed");
      expect(consoleError).toHaveBeenCalledWith("Could not apply remote history entries", expect.any(Error));
      consoleError.mockRestore();
    });
  });
});
