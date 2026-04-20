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

function makeFirestoreMock(): Firestore {
  const docRef = () => {
    const ref: any = { path: "mock/path" };
    ref.withConverter = () => ref;
    return ref;
  };
  return {
    doc: jest.fn(() => ({
      get: jest.fn(async () => ({ exists: true })),
      onSnapshot: jest.fn((callback: (doc: { exists: boolean }) => void) => {
        callback({ exists: true });
        return jest.fn();
      }),
    })),
    getFullPath: jest.fn((path: string) => path),
    documentRef: jest.fn(() => docRef()),
  } as unknown as Firestore;
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
async function setupManager() {
  const treeId = "main";
  const manager = TreeManager.create({ document: {}, undoStore: {} });
  const tree = ArrayTestTree.create({ key: treeId, uid: "test-user" });
  // setMainDocument also registers the tree under its key, so we do
  // not need a separate putTree call.
  manager.setMainDocument(tree as any);

  const historyManager = new FirestoreHistoryManagerConcurrent({
    firestore: makeFirestoreMock(),
    userContextProvider: makeUserContextProviderMock(),
    treeManager: manager,
    uploadLocalHistory: false,
    syncRemoteHistory: false,
  });

  await historyManager.environmentAndMetadataDocReadyPromise;
  await historyManager.getInitialLastHistoryEntry();

  return { manager, tree, historyManager, treeId };
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
});
