import { Instance, types } from "mobx-state-tree";
import firebase from "firebase/app";
import { deferred } from "promise-assist";
import { Firestore } from "../../lib/firestore";
import { createDocumentModel } from "../document/document";
import { DocumentContentModel, DocumentContentSnapshotType } from "../document/document-content";
import { ProblemDocument } from "../document/document-types";
import { TileContentModel } from "../tiles/tile-content";
import { HistoryStatus, TreeManager } from "./tree-manager";
import { getLastHistoryEntry as _getLastHistoryEntry,
  LastHistoryEntry,
  loadHistory as _loadHistory } from "./history-firestore";
import { UserModelType } from "../stores/user";
import { when } from "mobx";
import { HistoryEntrySnapshot } from "./history";

jest.mock("./history-firestore");
// This adds the mock api types to these two functions
const getLastHistoryEntry = jest.mocked(_getLastHistoryEntry);
const loadHistory = jest.mocked(_loadHistory);

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

  docModel.treeMonitor!.enabled = true;

  const tileContent = docContent.tileMap.get("t1")?.content as TestTileType;
  const manager = docModel.treeManagerAPI as Instance<typeof TreeManager>;
  const undoStore = manager.undoStore;

  return {docContent, tileContent, manager, undoStore};
}

const makeFirestoreMock = (docExists = false) => {
  return {
    doc: jest.fn(() => ({
      get: jest.fn(async () => ({
        exists: docExists
      }))
    }))
  } as unknown as Firestore;
};

describe("history loading", () => {
  it("initially has a status of NO_HISTORY", () => {
    const { manager } = setupDocument();
    // TODO: This should be changed. At this point we don't know if the
    // document has history or not. It is "NO_HISTORY" because the
    // "numHistoryEventsApplied" is 0 until the value is requested from
    // firestore. The improvement requires more state to track the
    // loading of the history instead of just using comparing the total
    // events to the number of events
    expect(manager.historyStatus).toBe(HistoryStatus.NO_HISTORY);
  });

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

  describe("mirrorHistoryFromFirestore", () => {
    it("results in zero history entries if loadHistory does nothing", async () => {
      const { manager } = setupDocument();
      const firestoreMock = makeFirestoreMock();
      // this makes loadHistory be a no op.
      loadHistory.mockReturnValue(() => undefined);
      await manager.mirrorHistoryFromFirestore({id: "1234"} as UserModelType, firestoreMock);
      expect(manager.document.history).toHaveLength(0);
    });

    it("creates a change doc with the history entries", async () => {
      const { manager } = setupDocument();
      const firestoreMock = makeFirestoreMock();
      loadHistory.mockImplementation((firestore, path, historyLoaded) => {
        // In the real world this callback will be delayed until the history documents
        // are actually loaded from firebase
        historyLoaded([
          { id: "a1" },
          { id: "a2" }
        ]);
        return () => undefined;
      });
      await manager.mirrorHistoryFromFirestore({id: "1234"} as UserModelType, firestoreMock);
      expect(manager.document.history).toHaveLength(2);
    });

    describe("updates the historyStatus", () => {

      interface IMirrorMockHistoryParam {
        entries: HistoryEntrySnapshot[];
        loadingError?: firebase.firestore.FirestoreError | undefined;
        lastHistoryEntry?: LastHistoryEntry;
      }

      /**
       * This does several things. It:
       * - mocks getLastHistoryEntry and loadHistory
       * - verifies the historyStatus after getLastHistoryEntry is called, but
       *   before it is resolved.
       * - waits until setNumHistoryEntriesAppliedFromFirestore has resolved.
       *
       * This allows us check the logic of manager.historyStatus based on
       * mock history entries, a loading error and a mock lastHistoryEntry
       *
       * @param param
       * @returns
       */
      async function mirrorMockHistory(param: IMirrorMockHistoryParam) {
        const { entries, loadingError, lastHistoryEntry } = param;
        const { manager } = setupDocument();
        const firestoreMock = makeFirestoreMock();
        // Delay the result to check that the history events applied is undefined
        // in the meantime and then changes when the delay is done
        const deferredResult = deferred<LastHistoryEntry>();
        const called = deferred<void>();
        getLastHistoryEntry.mockImplementation(() => {
          called.resolve();
          return deferredResult.promise;
        });
        loadHistory.mockImplementation((firestore, path, historyLoaded) => {
          // In the real world this callback will be delayed until the history documents
          // are actually loaded from firebase
          historyLoaded(entries, loadingError);
          return () => undefined;
        });
        await manager.mirrorHistoryFromFirestore({id: "1234"} as UserModelType, firestoreMock);

        await called.promise;
        // If we actually delayed the historyLoaded callback above we should be able to
        // see FINDING_HISTORY_LENGTH before the HISTORY_ERROR
        const initialStatus = loadingError ? HistoryStatus.HISTORY_ERROR : HistoryStatus.FINDING_HISTORY_LENGTH;
        expect(manager.historyStatus).toBe(initialStatus);
        expect(manager.numHistoryEventsApplied === undefined);
        deferredResult.resolve(lastHistoryEntry);

        // this seems to be the best way to wait for setNumHistoryEntriesAppliedFromFirestore to finish
        await when(() => manager.numHistoryEventsApplied !== undefined);

        return { manager };
      }

      it("is LOADED when there are more events than firestore length", async () => {
        const { manager } = await mirrorMockHistory({
          entries: [
            { id: "a1" },
            { id: "a2" }
          ]});

        // The history length is greater than the numHistoryEventsApplied
        expect(manager.historyStatus).toBe(HistoryStatus.HISTORY_LOADED);
      });

      it("is NO_HISTORY when there are no events and the firestore length is 0", async () => {
        const { manager } = await mirrorMockHistory({entries: []});

        expect(manager.historyStatus).toBe(HistoryStatus.NO_HISTORY);
      });

      it("is LOADED when the number of events match the firestore length", async () => {
        const { manager } = await mirrorMockHistory({
          entries:[
            { id: "a1" },
            { id: "a2" }
          ],
          lastHistoryEntry: {index: 1, id: "1234"}
        });

        // The history length is 1 plus the index of last history entry
        // so it should be 2 which matches the number of entries
        expect(manager.historyStatus).toBe(HistoryStatus.HISTORY_LOADED);
      });

      it("is ERROR when loadHistory returns an error", async () => {
        const { manager } = await mirrorMockHistory({
          entries:[],
          loadingError: { message: "fake error"} as firebase.firestore.FirestoreError,
          lastHistoryEntry: {index: 1, id: "1234"}
        });

        expect(manager.historyStatus).toBe(HistoryStatus.HISTORY_ERROR);
      });

      // FIXME: this is actually an error. If the history is corrupted and some
      // indexes are skipped, then the last entry will have an index which is bigger
      // than the number of loaded entries. We should track the loading better so we
      // can tell when the entries are actually loaded instead of comparing these values.
      // This case should be identified as a problem instead of just LOADING.
      it("is LOADING when number of events is less than firestore length", async () => {
        const { manager } = await mirrorMockHistory({
          entries:[
            { id: "a1" },
            { id: "a2" }
          ],
          lastHistoryEntry: {index: 2, id: "1234"}
        });

        // The history length is 1 plus the index of last history entry
        // so it should be 3 which is more than number of entries
        expect(manager.historyStatus).toBe(HistoryStatus.HISTORY_LOADING);
      });

    });

  });
});
