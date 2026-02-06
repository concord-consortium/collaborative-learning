import { Instance, types } from "mobx-state-tree";
import { deferred } from "promise-assist";
import { Firestore } from "../../lib/firestore";
import { createDocumentModel } from "../document/document";
import { DocumentContentModel, DocumentContentSnapshotType } from "../document/document-content";
import { ProblemDocument } from "../document/document-types";
import { TileContentModel } from "../tiles/tile-content";
import { TreeManager } from "./tree-manager";
import { getLastHistoryEntry as _getLastHistoryEntry } from "./history-firestore";

jest.mock("./history-firestore");
// This adds the mock api types to these two functions
const getLastHistoryEntry = jest.mocked(_getLastHistoryEntry);

const TestTile = TileContentModel
  .named("TestTile")
  .props({
    type: "TestTile",
    text: types.maybe(types.string),
    flag: types.maybe(types.boolean),
  })
  .actions(self => ({
    setFlag(_flag: boolean) {
      self.flag = _flag;
    },
    setText(value: string) {
      self.text = value;
    }
  }));
interface TestTileType extends Instance<typeof TestTile> {}

function setupDocument(initialContent? : DocumentContentSnapshotType) {
  const docContentSnapshot = initialContent ||  {
    tileMap: {
      "t1": {
        id: "t1",
        content: {
          type: "TestTile"
        },
      }
    }
  };
  const docContent = DocumentContentModel.create(docContentSnapshot);

  // This is needed to setup the tree monitor
  const docModel = createDocumentModel({
    uid: "1",
    type: ProblemDocument,
    key: "test",
    content: docContent as any
  });

  docModel.treeMonitor!.enableMonitoring();

  const tileContent = docContent.tileMap.get("t1")?.content as TestTileType;
  const manager = docModel.treeManagerAPI as Instance<typeof TreeManager>;
  const undoStore = manager.undoStore;

  return {docContent, tileContent, manager, undoStore};
}

describe("tree manager history", () => {
  describe("setNumHistoryEntriesAppliedFromFirestore", () => {
    it("updates numHistoryEntriesAppliedFromFirestore based on returned entry", async () => {
      const { manager } = setupDocument();
      getLastHistoryEntry.mockResolvedValue({index: 0, id: "1234"});
      await manager.setNumHistoryEntriesAppliedFromFirestore({} as Firestore, "");
      expect(manager.numHistoryEventsApplied).toBe(1);

      getLastHistoryEntry.mockResolvedValue({index: 10, id: "12345"});
      await manager.setNumHistoryEntriesAppliedFromFirestore({} as Firestore, "");
      expect(manager.numHistoryEventsApplied).toBe(11);
    });

    it("updates numHistoryEntriesAppliedFromFirestore to 0 with undefined entry", async () => {
      const { manager } = setupDocument();
      getLastHistoryEntry.mockResolvedValue(undefined);
      await manager.setNumHistoryEntriesAppliedFromFirestore({} as Firestore, "");
      expect(manager.numHistoryEventsApplied).toBe(0);

    });

    it("updates numHistoryEntriesAppliedFromFirestore until result from firestore", async () => {
      const { manager } = setupDocument();
      // Delay the result of getLastHistoryEntry, so we can check that the
      // state in the manager before the result is available.
      const deferredResult = deferred<undefined>();
      const called = deferred<void>();
      getLastHistoryEntry.mockImplementation(() => {
        called.resolve();
        return deferredResult.promise;
      });
      const actionPromise = manager.setNumHistoryEntriesAppliedFromFirestore({} as Firestore, "");
      // Make sure getLastHistoryEntry is called. Currently it is called
      // synchronously but in the future that might not be the case.
      await called.promise;
      // Test the state before it is resolved
      expect(manager.numHistoryEventsApplied).toBe(undefined);
      // Now actually provide the result
      deferredResult.resolve(undefined);
      await actionPromise;
      // Test the state after the action is finished
      expect(manager.numHistoryEventsApplied).toBe(0);
    });
  });
});
