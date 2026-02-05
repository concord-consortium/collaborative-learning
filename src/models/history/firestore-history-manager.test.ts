import { Instance, types } from "mobx-state-tree";
import firebase from "firebase/app";
import { deferred } from "promise-assist";
import { Firestore } from "../../lib/firestore";
import { createDocumentModel } from "../document/document";
import { DocumentContentModel, DocumentContentSnapshotType } from "../document/document-content";
import { ProblemDocument } from "../document/document-types";
import { TileContentModel } from "../tiles/tile-content";
import { TreeManager } from "./tree-manager";
import { getLastHistoryEntry as _getLastHistoryEntry,
  LastHistoryEntry,
  loadHistory as _loadHistory } from "./history-firestore";
import { when } from "mobx";
import { FirestoreHistoryManager, HistoryStatus } from "./firestore-history-manager";
import { UserContextProvider } from "../stores/user-context-provider";

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

  docModel.treeMonitor!.enableMonitoring();

  const tileContent = docContent.tileMap.get("t1")?.content as TestTileType;
  const treeManager = docModel.treeManagerAPI as Instance<typeof TreeManager>;
  const undoStore = treeManager.undoStore;

  return {docContent, tileContent, treeManager, undoStore};
}

const makeFirestoreMock = (docExists = true) => {
  return {
    doc: jest.fn(() => ({
      get: jest.fn(async () => ({
        exists: docExists
      })),
      // Mock onSnapshot to immediately call the callback with a doc that exists
      onSnapshot: jest.fn((callback: (doc: { exists: boolean }) => void) => {
        // Simulate the document existing (or not) based on the docExists parameter
        callback({ exists: docExists });
        // Return an unsubscribe function
        return jest.fn();
      })
    })),
    getFullPath: jest.fn((path: string) => path)
  } as unknown as Firestore;
};

const makeUserContextProviderMock = () => {
  return {
    userContext: {
      uid: "1234"
    }
  } as unknown as UserContextProvider;
};

function setupFirestoreHistoryManager(
  treeManager: Instance<typeof TreeManager>,
  firestoreMock?: Firestore
) {
  const firestore = firestoreMock ?? makeFirestoreMock();
  const userContextProviderMock = makeUserContextProviderMock();
  const historyManager = new FirestoreHistoryManager({
    firestore,
    userContextProvider: userContextProviderMock,
    treeManager,
    uploadLocalHistory: false,
    // Don't automatically call mirrorHistoryFromFirestore in constructor
    // so tests can set up mocks first
    syncRemoteHistory: false
  });
  return { historyManager, firestoreMock: firestore };
}

describe("history loading", () => {
  it("initially has a status of NO_HISTORY", () => {
    const { treeManager } = setupDocument();
    const { historyManager } = setupFirestoreHistoryManager(treeManager);
    // TODO: This should be changed. At this point we don't know if the
    // document has history or not. It is "NO_HISTORY" because the
    // "numHistoryEventsApplied" is 0 until the value is requested from
    // firestore. The improvement requires more state to track the
    // loading of the history instead of just using comparing the total
    // events to the number of events
    expect(historyManager.historyStatus).toBe(HistoryStatus.NO_HISTORY);
  });

  describe("setNumHistoryEntriesAppliedFromFirestore", () => {
    it("updates numHistoryEntriesAppliedFromFirestore based on returned entry", async () => {
      const { treeManager } = setupDocument();
      getLastHistoryEntry.mockResolvedValue({index: 0, id: "1234"});
      await treeManager.setNumHistoryEntriesAppliedFromFirestore({} as Firestore, "");
      expect(treeManager.numHistoryEventsApplied).toBe(1);

      getLastHistoryEntry.mockResolvedValue({index: 10, id: "12345"});
      await treeManager.setNumHistoryEntriesAppliedFromFirestore({} as Firestore, "");
      expect(treeManager.numHistoryEventsApplied).toBe(11);
    });

    it("updates numHistoryEntriesAppliedFromFirestore to 0 with undefined entry", async () => {
      const { treeManager } = setupDocument();
      getLastHistoryEntry.mockResolvedValue(undefined);
      await treeManager.setNumHistoryEntriesAppliedFromFirestore({} as Firestore, "");
      expect(treeManager.numHistoryEventsApplied).toBe(0);

    });

    it("updates numHistoryEntriesAppliedFromFirestore until result from firestore", async () => {
      const { treeManager } = setupDocument();
      // Delay the result of getLastHistoryEntry, so we can check that the
      // state in the manager before the result is available.
      const deferredResult = deferred<undefined>();
      const called = deferred<void>();
      getLastHistoryEntry.mockImplementation(() => {
        called.resolve();
        return deferredResult.promise;
      });
      const actionPromise = treeManager.setNumHistoryEntriesAppliedFromFirestore({} as Firestore, "");
      // Make sure getLastHistoryEntry is called. Currently it is called
      // synchronously but in the future that might not be the case.
      await called.promise;
      // Test the state before it is resolved
      expect(treeManager.numHistoryEventsApplied).toBe(undefined);
      // Now actually provide the result
      deferredResult.resolve(undefined);
      await actionPromise;
      // Test the state after the action is finished
      expect(treeManager.numHistoryEventsApplied).toBe(0);
    });
  });

  describe("subscribeToFirestoreHistory", () => {
    it("results in zero history entries if loadHistory does nothing", async () => {
      const { treeManager } = setupDocument();
      const { historyManager } = setupFirestoreHistoryManager(treeManager);
      // this makes loadHistory be a no op.
      loadHistory.mockReturnValue(() => undefined);
      await historyManager.subscribeToFirestoreHistory();
      expect(treeManager.document.history).toHaveLength(0);
    });

    it("creates a change doc with the history entries", async () => {
      const { treeManager } = setupDocument();
      const { historyManager } = setupFirestoreHistoryManager(treeManager);
      loadHistory.mockImplementation((firestore, path, historyLoaded) => {
        // In the real world this callback will be delayed until the history documents
        // are actually loaded from firebase
        historyLoaded([
          { index: 1, entry: { id: "a1" } },
          { index: 2, entry: { id: "a2" } }
        ]);
        return () => undefined;
      });
      await historyManager.subscribeToFirestoreHistory();
      expect(treeManager.document.history).toHaveLength(2);
    });

    it("sets HISTORY_ERROR when metadata document does not exist", async () => {
      jest.useFakeTimers();
      const { treeManager } = setupDocument();
      // Create a firestore mock where the document doesn't exist
      const firestoreMockNoDoc = makeFirestoreMock(false);
      const { historyManager } = setupFirestoreHistoryManager(treeManager, firestoreMockNoDoc);

      // Start mirrorHistoryFromFirestore - it will wait for metadata document
      const mirrorPromise = historyManager.subscribeToFirestoreHistory();

      // While waiting for the history it currently reports "No History"
      // TODO: This should be improved to show loading at this point.
      expect(historyManager.historyStatus).toBe(HistoryStatus.NO_HISTORY);

      // Fast-forward past the 5 second timeout
      jest.advanceTimersByTimeAsync(10000);

      console.log("Waiting for mirrorPromise");
      await mirrorPromise;
      console.log("mirrorPromise finished");

      // Should have set the error status since the metadata document was not found
      expect(historyManager.historyStatus).toBe(HistoryStatus.HISTORY_ERROR);

      jest.useRealTimers();
    });

    describe("updates the historyStatus", () => {

      interface IMirrorMockHistoryParam {
        entries: { id: string }[];
        loadingError?: firebase.firestore.FirestoreError | undefined;
        lastHistoryEntry?: LastHistoryEntry;
      }

      /**
       * This does several things. It:
       * - mocks getLastHistoryEntry and loadHistory
       * - waits until setNumHistoryEntriesAppliedFromFirestore has resolved.
       *
       * This allows us check the logic of historyManager.historyStatus based on
       * mock history entries, a loading error and a mock lastHistoryEntry
       *
       * @param param
       * @returns
       */
      async function mirrorMockHistory(param: IMirrorMockHistoryParam) {
        const { entries, loadingError, lastHistoryEntry } = param;
        const { treeManager } = setupDocument();
        const { historyManager } = setupFirestoreHistoryManager(treeManager);

        // Mock getLastHistoryEntry to return the lastHistoryEntry
        // This is called in prepareFirestoreHistoryInfo
        getLastHistoryEntry.mockResolvedValue(lastHistoryEntry);

        loadHistory.mockImplementation((firestore, path, historyLoaded) => {
          // In the real world this callback will be delayed until the history documents
          // are actually loaded from firebase
          const historyEntryDocs = entries.map((entry, index) => ({
            index,
            entry
          }));
          historyLoaded(historyEntryDocs, loadingError);
          return () => undefined;
        });

        await historyManager.subscribeToFirestoreHistory();

        // Wait for setNumHistoryEntriesAppliedFromFirestore to finish
        await when(() => treeManager.numHistoryEventsApplied !== undefined);

        return { treeManager, historyManager };
      }

      it("is LOADED when there are more events than firestore length", async () => {
        const { historyManager } = await mirrorMockHistory({
          entries: [
            { id: "a1" },
            { id: "a2" }
          ]});

        // The history length is greater than the numHistoryEventsApplied
        expect(historyManager.historyStatus).toBe(HistoryStatus.HISTORY_LOADED);
      });

      it("is NO_HISTORY when there are no events and the firestore length is 0", async () => {
        const { historyManager } = await mirrorMockHistory({entries: []});

        expect(historyManager.historyStatus).toBe(HistoryStatus.NO_HISTORY);
      });

      it("is LOADED when the number of events match the firestore length", async () => {
        const { historyManager } = await mirrorMockHistory({
          entries:[
            { id: "a1" },
            { id: "a2" }
          ],
          lastHistoryEntry: {index: 1, id: "1234"}
        });

        expect(historyManager.historyStatus).toBe(HistoryStatus.HISTORY_LOADED);
      });

      it("is LOADING when there are fewer events than the firestore length", async () => {
        const { historyManager } = await mirrorMockHistory({
          entries: [
            { id: "a1" }
          ],
          lastHistoryEntry: {index: 10, id: "1234"}
        });

        expect(historyManager.historyStatus).toBe(HistoryStatus.HISTORY_LOADING);
      });

      it("is ERROR when there is a loadingError", async () => {
        const { historyManager } = await mirrorMockHistory({
          entries: [],
          loadingError: { message: "test error" } as firebase.firestore.FirestoreError
        });

        expect(historyManager.historyStatus).toBe(HistoryStatus.HISTORY_ERROR);
      });
    });
  });
});
