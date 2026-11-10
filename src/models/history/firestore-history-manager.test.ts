import { Instance, types } from "mobx-state-tree";
import firebase from "firebase/app";
import { deferred } from "promise-assist";
import { Firestore } from "../../lib/firestore";
import { createDocumentModel, ISavedEnvelope } from "../document/document";
import { DocumentContentModel, DocumentContentSnapshotType } from "../document/document-content";
import { ProblemDocument } from "../document/document-types";
import { TileContentModel } from "../tiles/tile-content";
import { registerTileContentInfo } from "../tiles/tile-content-info";
import { TreeManager } from "./tree-manager";
import { getHistoryEntriesAfter as _getHistoryEntriesAfter,
  getLastHistoryEntry as _getLastHistoryEntry,
  LastHistoryEntry,
  loadHistory as _loadHistory } from "./history-firestore";
import { when } from "mobx";
import { HistoryEntry, HistoryEntrySnapshot } from "./history";
import { FirestoreHistoryManager, HistoryStatus } from "./firestore-history-manager";
import { UserContextProvider } from "../stores/user-context-provider";
import { kHistoryStart } from "./session-exactness";
import { LogEventName } from "../../lib/logger-types";

jest.mock("./history-firestore");
// This adds the mock api types to these functions
const getLastHistoryEntry = jest.mocked(_getLastHistoryEntry);
const loadHistory = jest.mocked(_loadHistory);
const getHistoryEntriesAfter = jest.mocked(_getHistoryEntriesAfter);

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
registerTileContentInfo({
  type: "TestTile",
  modelClass: TestTile,
  defaultContent() {
    return TestTile.create();
  }
});

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

const makeUserContextProviderMock = (uid = "1234") => {
  return {
    userContext: {
      uid
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
  interface IMirrorMockHistoryParam {
    entries: HistoryEntrySnapshot[];
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
        id: `e${index}`,
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

  describe("local load entry", () => {
    const loadEntry: HistoryEntrySnapshot = { id: "loadEntry", isLoadEntry: true };

    async function subscribeWithLocalEntry(entries: HistoryEntrySnapshot[], lastHistoryEntry?: LastHistoryEntry) {
      const { treeManager } = setupDocument();
      const { historyManager } = setupFirestoreHistoryManager(treeManager);
      treeManager.setLocalLoadEntry(loadEntry);
      getLastHistoryEntry.mockResolvedValue(lastHistoryEntry);
      loadHistory.mockImplementation((firestore, path, historyLoaded) => {
        historyLoaded(entries.map((entry, index) => ({ id: entry.id!, index, entry })));
        return () => undefined;
      });
      await historyManager.subscribeToFirestoreHistory();
      await when(() => treeManager.numHistoryEventsApplied !== undefined);
      return { treeManager, historyManager };
    }

    it("keeps a local load entry out of the history and the starting position", async () => {
      const { treeManager, historyManager } = await subscribeWithLocalEntry(
        [{ id: "a1" }, { id: "a2" }], { index: 1, id: "a2" });
      expect(treeManager.document.history.map(e => e.id)).toEqual(["a1", "a2"]);
      expect(treeManager.numHistoryEventsApplied).toBe(2);
      expect(historyManager.historyStatus).toBe(HistoryStatus.HISTORY_LOADED);
      expect(treeManager.needsJsonCopy).toBe(true);
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
          { id: "a1", index: 1, entry: { id: "a1" } },
          { id: "a2", index: 2, entry: { id: "a2" } }
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
      const subscribePromise = historyManager.subscribeToFirestoreHistory();

      // While waiting for the history it currently reports "No History"
      // TODO: This should be improved to show loading at this point.
      expect(historyManager.historyStatus).toBe(HistoryStatus.NO_HISTORY);

      // Fast-forward past the 5 second timeout
      jest.advanceTimersByTimeAsync(10000);

      await subscribePromise;

      // Should have set the error status since the metadata document was not found
      expect(historyManager.historyStatus).toBe(HistoryStatus.HISTORY_ERROR);

      jest.useRealTimers();
    });

    describe("updates the historyStatus", () => {


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

        // The history length is 1 plus the index of last history entry
        // so it should be 2 which matches the number of entries
        expect(historyManager.historyStatus).toBe(HistoryStatus.HISTORY_LOADED);
      });

      it("is ERROR when loadHistory returns an error", async () => {
        const { historyManager } = await mirrorMockHistory({
          entries:[],
          loadingError: { message: "fake error"} as firebase.firestore.FirestoreError,
          lastHistoryEntry: {index: 1, id: "1234"}
        });

        expect(historyManager.historyStatus).toBe(HistoryStatus.HISTORY_ERROR);
      });

      // FIXME: this is actually an error. If the history is corrupted and some
      // indexes are skipped, then the last entry will have an index which is bigger
      // than the number of loaded entries. We should track the loading better so we
      // can tell when the entries are actually loaded instead of comparing these values.
      // This case should be identified as a problem instead of just LOADING.
      it("is LOADING when number of events is less than firestore length", async () => {
        const { historyManager } = await mirrorMockHistory({
          entries:[
            { id: "a1" },
            { id: "a2" }
          ],
          lastHistoryEntry: {index: 2, id: "1234"}
        });

        // The history length is 1 plus the index of last history entry
        // so it should be 3 which is more than number of entries
        expect(historyManager.historyStatus).toBe(HistoryStatus.HISTORY_LOADING);
      });


    });

  });

  describe("moveToHistoryEntryAfterLoad", () => {
    afterEach(() => jest.restoreAllMocks());

    /**
     * Stands in for goToHistoryEntryPosition doing its job: a seek that replays every entry it was
     * asked for ends with numHistoryEventsApplied at the requested position.
     */
    function mockCompletedSeek(treeManager: Instance<typeof TreeManager>) {
      return jest.spyOn(treeManager, "goToHistoryEntryPosition").mockImplementation(((position: number) => {
        treeManager.setNumHistoryEntriesApplied(position);
        return Promise.resolve();
      }) as any);
    }

    // A link names the entry the document had reached when the event was logged, so the
    // requested moment is the one with that entry applied: the position after it, not before.
    it("seeks to the position where the requested entry has been applied", async () => {
      const { treeManager, historyManager } = await mirrorMockHistory({
        entries: [{ id: "a1" }, { id: "a2" }]
      });
      const goToSpy = mockCompletedSeek(treeManager);
      await historyManager.moveToHistoryEntryAfterLoad("a2");
      expect(goToSpy).toHaveBeenCalledWith(2);
    });

    it("treats the 'first' sentinel as position 0", async () => {
      const { treeManager, historyManager } = await mirrorMockHistory({
        entries: [{ id: "a1" }, { id: "a2" }]
      });
      const goToSpy = mockCompletedSeek(treeManager);
      await historyManager.moveToHistoryEntryAfterLoad("first");
      expect(goToSpy).toHaveBeenCalledWith(0);
    });

    it("warns and does not navigate for an unresolved id", async () => {
      const { treeManager, historyManager } = await mirrorMockHistory({
        entries: [{ id: "a1" }, { id: "a2" }]
      });
      const goToSpy = jest.spyOn(treeManager, "goToHistoryEntryPosition").mockImplementation(() => undefined as any);
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      await historyManager.moveToHistoryEntryAfterLoad("no-such-id");
      expect(goToSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });

    // A console.warn is invisible to the researcher following a link from a report, who would
    // otherwise just read the end of the history believing it to be the requested moment.
    it("reports an unresolved id so it can be shown to the user", async () => {
      const { treeManager, historyManager } = await mirrorMockHistory({
        entries: [{ id: "a1" }, { id: "a2" }]
      });
      jest.spyOn(treeManager, "goToHistoryEntryPosition").mockImplementation(() => undefined as any);
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
      await historyManager.moveToHistoryEntryAfterLoad("no-such-id");
      expect(historyManager.historyEntryRequestError).toEqual(expect.stringContaining("no-such-id"));
    });

    // Waiting for the history to load can take up to 30 seconds, and the message from an
    // earlier request would otherwise sit on screen for all of it, describing a request the
    // reader has already replaced.
    it("clears an earlier request's message as soon as a new request starts", async () => {
      const { treeManager, historyManager } = await mirrorMockHistory({
        entries: [{ id: "a1" }, { id: "a2" }]
      });
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
      await historyManager.moveToHistoryEntryAfterLoad("no-such-id");
      expect(historyManager.historyEntryRequestError).toEqual(expect.any(String));

      mockCompletedSeek(treeManager);
      const seekPromise = historyManager.moveToHistoryEntryAfterLoad("a2");
      expect(historyManager.historyEntryRequestError).toBeUndefined();
      await seekPromise;
    });

    it("reports nothing when the seek succeeds", async () => {
      const { treeManager, historyManager } = await mirrorMockHistory({
        entries: [{ id: "a1" }, { id: "a2" }]
      });
      mockCompletedSeek(treeManager);
      await historyManager.moveToHistoryEntryAfterLoad("a2");
      expect(historyManager.historyEntryRequestError).toBeUndefined();
    });

    it("reports a seek that stops short of the requested entry", async () => {
      const { treeManager, historyManager } = await mirrorMockHistory({
        entries: [{ id: "a1" }, { id: "a2" }, { id: "a3" }]
      });
      jest.spyOn(treeManager, "goToHistoryEntryPosition").mockImplementation((() => {
        treeManager.setNumHistoryEntriesApplied(1);
        return Promise.resolve();
      }) as any);
      jest.spyOn(console, "warn").mockImplementation(() => undefined);

      // "a3" is index 2, but the replay only gets as far as 1.
      await historyManager.moveToHistoryEntryAfterLoad("a3");

      expect(historyManager.historyEntryRequestError).toEqual(expect.stringContaining("a3"));
    });

    it("reports a seek that throws", async () => {
      const { treeManager, historyManager } = await mirrorMockHistory({
        entries: [{ id: "a1" }, { id: "a2" }]
      });
      jest.spyOn(treeManager, "goToHistoryEntryPosition")
        .mockImplementation((() => Promise.reject(new Error("replay blew up"))) as any);
      jest.spyOn(console, "warn").mockImplementation(() => undefined);

      await historyManager.moveToHistoryEntryAfterLoad("a2");

      expect(historyManager.historyEntryRequestError).toEqual(expect.any(String));
    });

    // A Firestore failure ends the load in HISTORY_ERROR rather than leaving it unfinished, so
    // the wait resolves and it is the status, not a timeout, that says the request cannot be met.
    it("reports a history that fails to load so it can be shown to the user", async () => {
      const { treeManager, historyManager } = await mirrorMockHistory({
        entries: [],
        loadingError: { message: "fake error" } as firebase.firestore.FirestoreError,
        lastHistoryEntry: { index: 1, id: "1234" }
      });
      const goToSpy = jest.spyOn(treeManager, "goToHistoryEntryPosition")
        .mockImplementation(() => undefined as any);
      jest.spyOn(console, "warn").mockImplementation(() => undefined);

      await historyManager.moveToHistoryEntryAfterLoad("first");

      expect(historyManager.historyStatus).toBe(HistoryStatus.HISTORY_ERROR);
      expect(historyManager.historyEntryRequestError).toEqual(expect.any(String));
      expect(goToSpy).not.toHaveBeenCalled();
    });

    it("reports a history that never loads so it can be shown to the user", async () => {
      jest.useFakeTimers();
      const { treeManager } = setupDocument();
      const { historyManager } = setupFirestoreHistoryManager(treeManager);
      jest.spyOn(treeManager, "goToHistoryEntryPosition").mockImplementation(() => undefined as any);
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const seekPromise = historyManager.moveToHistoryEntryAfterLoad("first");
      await jest.advanceTimersByTimeAsync(30000);
      await seekPromise;
      expect(historyManager.historyEntryRequestError).toEqual(expect.any(String));
      jest.useRealTimers();
    });

    // The real ordering: PlaybackComponent calls this from a mount effect while the status is still
    // the initial NO_HISTORY, before the Firestore query resolves. The seek must wait for the load
    // and then happen — this is the case the earlier "stop on NO_HISTORY" version regressed.
    it("seeks once the history loads when called before the load resolves", async () => {
      const { treeManager } = setupDocument();
      const { historyManager } = setupFirestoreHistoryManager(treeManager);
      getLastHistoryEntry.mockResolvedValue(undefined);
      loadHistory.mockImplementation((firestore, path, historyLoaded) => {
        historyLoaded([{ id: "a1", index: 0, entry: { id: "a1" } }, { id: "a2", index: 1, entry: { id: "a2" } }]);
        return () => undefined;
      });
      const goToSpy = mockCompletedSeek(treeManager);

      // Status is the initial NO_HISTORY here — call BEFORE the history loads.
      expect(historyManager.historyStatus).toBe(HistoryStatus.NO_HISTORY);
      const seekPromise = historyManager.moveToHistoryEntryAfterLoad("a2");

      // Now load the history; the pending seek proceeds once the status becomes LOADED.
      await historyManager.subscribeToFirestoreHistory();
      await when(() => treeManager.numHistoryEventsApplied !== undefined);
      await seekPromise;

      expect(goToSpy).toHaveBeenCalled();
    });

    // A genuinely empty document stays NO_HISTORY forever, so the bounded wait must time out
    // (not hang) and give up without navigating.
    it("warns and does not navigate when the history never loads (times out)", async () => {
      jest.useFakeTimers();
      const { treeManager } = setupDocument();
      const { historyManager } = setupFirestoreHistoryManager(treeManager);
      const goToSpy = jest.spyOn(treeManager, "goToHistoryEntryPosition").mockImplementation(() => undefined as any);
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const seekPromise = historyManager.moveToHistoryEntryAfterLoad("first");
      await jest.advanceTimersByTimeAsync(30000);
      await seekPromise;
      expect(goToSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      jest.useRealTimers();
    });
  });
});

describe("onHistoryEntryCompleted", () => {
  function setupUploadingManager(set: jest.Mock, uploadLocalHistory = true) {
    const { treeManager } = setupDocument();
    const firestore = {
      ...makeFirestoreMock(),
      documentRef: jest.fn(() => ({ set })),
      timestamp: jest.fn(() => new Date())
    } as unknown as Firestore;
    const historyManager = new FirestoreHistoryManager({
      firestore,
      userContextProvider: makeUserContextProviderMock(),
      treeManager,
      uploadLocalHistory,
      syncRemoteHistory: false
    });
    historyManager.firestoreHistoryInfoPromise =
      Promise.resolve({ documentPath: "d", lastEntryIndex: -1, lastEntryId: null });
    historyManager.onLocalEntryUploaded = jest.fn();
    const entry = HistoryEntry.create({ id: "e1", tree: "test", model: "TestTile", action: "/setFlag" });
    return { treeManager, historyManager, entry };
  }

  it("reports the entry after its set resolves", async () => {
    const setResult = deferred<void>();
    const set = jest.fn(() => setResult.promise);
    const { treeManager, historyManager, entry } = setupUploadingManager(set);
    const completed = historyManager.onHistoryEntryCompleted(treeManager.document, entry, 0);
    await new Promise(process.nextTick);
    expect(set).toHaveBeenCalledTimes(1);
    expect(historyManager.onLocalEntryUploaded).not.toHaveBeenCalled();
    setResult.resolve();
    await completed;
    expect(historyManager.onLocalEntryUploaded).toHaveBeenCalledTimes(1);
    expect(historyManager.onLocalEntryUploaded).toHaveBeenCalledWith(entry);
  });

  it("does not report an entry whose set rejects", async () => {
    const set = jest.fn(() => Promise.reject(new Error("permission-denied")));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const { treeManager, historyManager, entry } = setupUploadingManager(set);
    await historyManager.onHistoryEntryCompleted(treeManager.document, entry, 0);
    expect(historyManager.onLocalEntryUploaded).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does not report an entry when uploadLocalHistory is false", async () => {
    const set = jest.fn(() => Promise.resolve());
    const { treeManager, historyManager, entry } = setupUploadingManager(set, false);
    await historyManager.onHistoryEntryCompleted(treeManager.document, entry, 0);
    expect(set).not.toHaveBeenCalled();
    expect(historyManager.onLocalEntryUploaded).not.toHaveBeenCalled();
  });

  it("does not report an entry when the metadata document never appears", async () => {
    const set = jest.fn(() => Promise.resolve());
    const { treeManager, historyManager, entry } = setupUploadingManager(set);
    historyManager.firestoreHistoryInfoPromise = Promise.reject(new Error("metadata document not found"));
    await expect(historyManager.onHistoryEntryCompleted(treeManager.document, entry, 0)).rejects.toThrow();
    expect(set).not.toHaveBeenCalled();
    expect(historyManager.onLocalEntryUploaded).not.toHaveBeenCalled();
  });

  describe("commit signals", () => {
    function setupCommits(sets: Array<ReturnType<typeof deferred<void>>>) {
      let call = 0;
      const set = jest.fn(() => sets[call++].promise);
      const setup = setupUploadingManager(set);
      const entries = ["e1", "e2", "e3"].map(id =>
        HistoryEntry.create({ id, tree: "test", model: "TestTile", action: "/setFlag" }));
      const onCommitted = jest.fn();
      const removeListener = setup.historyManager.addCommitListener({ onCommitted, onUncommittedVoided: jest.fn() });
      const complete = (i: number) =>
        setup.historyManager.onHistoryEntryCompleted(setup.treeManager.document, entries[i], i);
      return { ...setup, entries, onCommitted, removeListener, complete };
    }
    const flush = () => new Promise(process.nextTick);

    it("reports an entry committed once it and every earlier entry have uploaded", async () => {
      const sets = [deferred<void>(), deferred<void>(), deferred<void>()];
      const { historyManager, onCommitted, complete } = setupCommits(sets);
      const completions = [complete(0), complete(1), complete(2)];
      await flush();
      expect(historyManager.lastCommitted).toBeUndefined();

      sets[1].resolve();
      await flush();
      expect(onCommitted).not.toHaveBeenCalled();

      sets[0].resolve();
      await flush();
      expect(onCommitted).toHaveBeenCalledTimes(1);
      expect(onCommitted).toHaveBeenLastCalledWith([{ id: "e1", index: 0 }, { id: "e2", index: 1 }]);

      sets[2].resolve();
      await Promise.all(completions);
      expect(onCommitted).toHaveBeenCalledTimes(2);
      expect(onCommitted).toHaveBeenLastCalledWith([{ id: "e3", index: 2 }]);
      expect(historyManager.lastCommitted).toEqual({ id: "e3", index: 2 });
    });

    it("never reports entries after an upload that fails", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const sets = [deferred<void>(), deferred<void>(), deferred<void>()];
      const { historyManager, onCommitted, complete } = setupCommits(sets);
      const completions = [complete(0), complete(1), complete(2)];
      await flush();
      sets[0].reject(new Error("permission-denied"));
      sets[1].resolve();
      sets[2].resolve();
      await Promise.all(completions);
      expect(onCommitted).not.toHaveBeenCalled();
      expect(historyManager.lastCommitted).toBeUndefined();
      warn.mockRestore();
    });

    it("stops reporting to a listener once it is removed", async () => {
      const sets = [deferred<void>(), deferred<void>(), deferred<void>()];
      const { onCommitted, removeListener, complete } = setupCommits(sets);
      const first = complete(0);
      const second = complete(1);
      await flush();
      sets[0].resolve();
      await first;
      expect(onCommitted).toHaveBeenCalledTimes(1);
      removeListener();
      sets[1].resolve();
      await second;
      expect(onCommitted).toHaveBeenCalledTimes(1);
    });
  });
});

describe("catchUpAtLoad", () => {
  const documentPath = "documents/test";

  beforeEach(() => {
    getLastHistoryEntry.mockReset();
    getHistoryEntriesAfter.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function textEntry(id: string, tree = "test"): HistoryEntrySnapshot {
    return {
      id, tree, model: "TestTile", action: "/content/tileMap/t1/content/setText", state: "complete",
      records: [{
        tree, action: "/content/tileMap/t1/content/setText",
        patches: [{ op: "replace", path: "/content/tileMap/t1/content/text", value: id }],
        inversePatches: [{ op: "replace", path: "/content/tileMap/t1/content/text", value: undefined }]
      }]
    } as HistoryEntrySnapshot;
  }

  function entryDoc(index: number, previousEntryId: string, entry = textEntry(`e${index}`)) {
    return { id: entry.id!, index, previousEntryId, entry };
  }

  function setupCatchUp(loadedEnvelope: ISavedEnvelope | undefined, lastHistoryEntry: LastHistoryEntry,
      options: { uploadLocalHistory?: boolean, firestore?: Firestore, uid?: string } = {}) {
    const { treeManager, tileContent } = setupDocument();
    const setCalled = deferred<void>();
    const set = jest.fn(() => {
      setCalled.resolve();
      return Promise.resolve();
    });
    const firestore = options.firestore ?? {
      ...makeFirestoreMock(),
      documentRef: jest.fn(() => ({ set })),
      timestamp: jest.fn(() => new Date())
    } as unknown as Firestore;
    getLastHistoryEntry.mockResolvedValue(lastHistoryEntry);
    const logEvent = jest.fn();
    const historyManager = new FirestoreHistoryManager({
      firestore,
      // setupDocument's document belongs to user "1"
      userContextProvider: makeUserContextProviderMock(options.uid ?? "1"),
      treeManager,
      uploadLocalHistory: options.uploadLocalHistory ?? true,
      syncRemoteHistory: false,
      loadedEnvelope,
      logEvent
    });
    return { treeManager, tileContent, historyManager, firestore, set, setCalled, logEvent };
  }

  it("reads nothing more when the envelope is at Firestore's last entry", async () => {
    const { treeManager, historyManager } = setupCatchUp(
      { lastHistoryEntryId: "e7", exactThrough: { index: 7, since: "e2" } },
      { id: "e7", index: 7 });
    await historyManager.catchUpAtLoad();
    expect(getHistoryEntriesAfter).not.toHaveBeenCalled();
    expect(historyManager.caughtUpTo).toBeUndefined();
    expect(treeManager.exactness.exactSince).toBe("e2");
    expect(treeManager.exactness.isExact).toBe(true);
  });

  it("starts at the saved id when an envelope without exactThrough is at Firestore's last entry", async () => {
    const { treeManager, historyManager } = setupCatchUp(
      { lastHistoryEntryId: "e7" }, { id: "e7", index: 7 });
    await historyManager.catchUpAtLoad();
    expect(treeManager.exactness.exactSince).toBe("e7");
    expect(treeManager.exactness.isExact).toBe(true);
  });

  it("applies the missing entries and keeps exactSince when the envelope has exactThrough", async () => {
    const { treeManager, tileContent, historyManager, firestore } = setupCatchUp(
      { lastHistoryEntryId: "e5", exactThrough: { index: 5, since: "e2" } },
      { id: "e7", index: 7 });
    getHistoryEntriesAfter.mockResolvedValue([entryDoc(6, "e5"), entryDoc(7, "e6")]);
    await historyManager.catchUpAtLoad();
    expect(getHistoryEntriesAfter).toHaveBeenCalledWith(firestore, documentPath, 5, 7);
    expect(tileContent.text).toBe("e7");
    expect(historyManager.caughtUpTo).toEqual({ id: "e7", index: 7 });
    expect(treeManager.document.history.length).toBe(0);
    expect(treeManager.exactness.exactSince).toBe("e2");
    expect(treeManager.exactness.isExact).toBe(true);
  });

  it("doesn't catch up from an envelope without exactThrough, and leaves the session not exact", async () => {
    const { treeManager, tileContent, historyManager, logEvent } = setupCatchUp(
      { lastHistoryEntryId: "e5" }, { id: "e7", index: 7 });
    getHistoryEntriesAfter.mockResolvedValue([entryDoc(6, "e5"), entryDoc(7, "e6")]);
    await historyManager.catchUpAtLoad();
    expect(getHistoryEntriesAfter).not.toHaveBeenCalled();
    expect(tileContent.text).toBeUndefined();
    expect(historyManager.caughtUpTo).toBeUndefined();
    expect(treeManager.exactness.isExact).toBe(false);
    expect(treeManager.exactness.notExactReason).toBe("unmarked-envelope-gap");
    expect(logEvent).toHaveBeenCalledWith(LogEventName.HISTORY_LOAD_CATCH_UP_INCOMPLETE,
      expect.objectContaining({ reason: "unmarked-envelope-gap", savedId: "e5" }));
  });

  it("starts at the beginning of history for a document with no history", async () => {
    const { treeManager, historyManager } = setupCatchUp(undefined, undefined);
    await historyManager.catchUpAtLoad();
    expect(getHistoryEntriesAfter).not.toHaveBeenCalled();
    expect(treeManager.exactness.exactSince).toBe(kHistoryStart);
    expect(treeManager.exactness.isExact).toBe(true);
  });

  it("starts at Firestore's last entry when there is no saved envelope", async () => {
    const { treeManager, historyManager } = setupCatchUp(undefined, { id: "e7", index: 7 });
    await historyManager.catchUpAtLoad();
    expect(getHistoryEntriesAfter).not.toHaveBeenCalled();
    expect(treeManager.exactness.exactSince).toBe("e7");
  });

  it("doesn't fetch a gap over 200 entries and leaves the session not exact", async () => {
    const { treeManager, tileContent, historyManager, logEvent } = setupCatchUp(
      { lastHistoryEntryId: "e5", exactThrough: { index: 5, since: "e2" } },
      { id: "e300", index: 300 });
    await historyManager.catchUpAtLoad();
    expect(getHistoryEntriesAfter).not.toHaveBeenCalled();
    expect(tileContent.text).toBeUndefined();
    expect(treeManager.exactness.isExact).toBe(false);
    expect(treeManager.exactness.notExactReason).toBe("catch-up-gap-too-large");
    expect(logEvent).toHaveBeenCalledWith(LogEventName.HISTORY_LOAD_CATCH_UP_INCOMPLETE,
      expect.objectContaining({ reason: "catch-up-gap-too-large", gap: 295 }));
  });

  it("applies entries up to a hole and leaves the session not exact", async () => {
    const { treeManager, tileContent, historyManager, logEvent } = setupCatchUp(
      { lastHistoryEntryId: "e5", exactThrough: { index: 5, since: "e2" } },
      { id: "e8", index: 8 });
    getHistoryEntriesAfter.mockResolvedValue([entryDoc(6, "e5"), entryDoc(8, "e7")]);
    await historyManager.catchUpAtLoad();
    expect(tileContent.text).toBe("e6");
    expect(historyManager.caughtUpTo).toEqual({ id: "e6", index: 6 });
    expect(treeManager.exactness.isExact).toBe(false);
    expect(treeManager.exactness.notExactReason).toBe("catch-up-hole");
    expect(logEvent).toHaveBeenCalledWith(LogEventName.HISTORY_LOAD_CATCH_UP_INCOMPLETE,
      expect.objectContaining({ reason: "catch-up-hole" }));
  });

  it("treats entries that stop short of Firestore's last entry as a hole", async () => {
    const { treeManager, tileContent, historyManager } = setupCatchUp(
      { lastHistoryEntryId: "e5", exactThrough: { index: 5, since: "e2" } },
      { id: "e7", index: 7 });
    getHistoryEntriesAfter.mockResolvedValue([entryDoc(6, "e5")]);
    await historyManager.catchUpAtLoad();
    expect(tileContent.text).toBe("e6");
    expect(treeManager.exactness.notExactReason).toBe("catch-up-hole");
  });

  it("leaves the session not exact when the envelope names an id Firestore has no entry for", async () => {
    const { treeManager, historyManager } = setupCatchUp(
      { lastHistoryEntryId: "e5", exactThrough: { index: 5, since: "e2" } }, undefined);
    await historyManager.catchUpAtLoad();
    expect(getHistoryEntriesAfter).not.toHaveBeenCalled();
    expect(treeManager.exactness.notExactReason).toBe("saved-id-missing");
  });

  it("leaves the session not exact when an entry fails to apply, keeping what applied", async () => {
    const { treeManager, tileContent, historyManager, logEvent } = setupCatchUp(
      { lastHistoryEntryId: "e5", exactThrough: { index: 5, since: "e2" } },
      { id: "e7", index: 7 });
    getHistoryEntriesAfter.mockResolvedValue([
      entryDoc(6, "e5"), entryDoc(7, "e6", textEntry("e7", "no-such-tree"))
    ]);
    await historyManager.catchUpAtLoad();
    expect(tileContent.text).toBe("e6");
    expect(historyManager.caughtUpTo).toEqual({ id: "e6", index: 6 });
    expect(treeManager.exactness.isExact).toBe(false);
    expect(treeManager.exactness.notExactReason).toBe("catch-up-apply-failed");
    expect(logEvent).toHaveBeenCalledWith(LogEventName.HISTORY_LOAD_CATCH_UP_INCOMPLETE,
      expect.objectContaining({ reason: "catch-up-apply-failed", error: "Unknown tree 'no-such-tree'" }));
  });

  it("leaves the session not exact when the history can't be read", async () => {
    jest.useFakeTimers();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const { treeManager, historyManager } = setupCatchUp(
      { lastHistoryEntryId: "e5", exactThrough: { index: 5, since: "e2" } },
      { id: "e7", index: 7 }, { firestore: makeFirestoreMock(false) });
    const catchUp = historyManager.catchUpAtLoad();
    await jest.advanceTimersByTimeAsync(10000);
    await catchUp;
    expect(treeManager.exactness.isExact).toBe(false);
    expect(treeManager.exactness.notExactReason).toBe("history-unavailable");
  });

  it("skips another user's document without reading its history", async () => {
    const { treeManager, historyManager } = setupCatchUp(
      { lastHistoryEntryId: "e5", exactThrough: { index: 5, since: "e2" } },
      { id: "e7", index: 7 }, { uid: "2" });
    expect(historyManager.isOtherUsersDocument).toBe(true);
    await historyManager.catchUpAtLoad();
    expect(getLastHistoryEntry).not.toHaveBeenCalled();
    expect(getHistoryEntriesAfter).not.toHaveBeenCalled();
    expect(treeManager.exactness.exactSince).toBeUndefined();
    expect(treeManager.exactness.notExactReason).toBeUndefined();
  });

  it("catches up while the current user isn't known yet", async () => {
    const { treeManager, tileContent, historyManager } = setupCatchUp(
      { lastHistoryEntryId: "e5", exactThrough: { index: 5, since: "e2" } },
      { id: "e7", index: 7 }, { uid: "0" });
    getHistoryEntriesAfter.mockResolvedValue([entryDoc(6, "e5"), entryDoc(7, "e6")]);
    expect(historyManager.isOtherUsersDocument).toBe(false);
    await historyManager.catchUpAtLoad();
    expect(tileContent.text).toBe("e7");
    expect(treeManager.exactness.exactSince).toBe("e2");
  });

  it("treats a fetched entry doc without an entry as a hole", async () => {
    const { treeManager, tileContent, historyManager } = setupCatchUp(
      { lastHistoryEntryId: "e5", exactThrough: { index: 5, since: "e2" } },
      { id: "e7", index: 7 });
    getHistoryEntriesAfter.mockResolvedValue([
      entryDoc(6, "e5"), { ...entryDoc(7, "e6"), entry: undefined as unknown as HistoryEntrySnapshot }
    ]);
    await historyManager.catchUpAtLoad();
    expect(tileContent.text).toBe("e6");
    expect(treeManager.exactness.notExactReason).toBe("catch-up-hole");
  });

  it("skips the catch-up for a manager that doesn't upload local history", async () => {
    const { treeManager, historyManager } = setupCatchUp(
      { lastHistoryEntryId: "e5", exactThrough: { index: 5, since: "e2" } },
      { id: "e7", index: 7 }, { uploadLocalHistory: false });
    await historyManager.catchUpAtLoad();
    expect(getLastHistoryEntry).not.toHaveBeenCalled();
    expect(treeManager.exactness.exactSince).toBeUndefined();
    expect(treeManager.exactness.notExactReason).toBeUndefined();
  });

  it("chains the next local entry after Firestore's last entry", async () => {
    const { treeManager, tileContent, historyManager, set, setCalled } = setupCatchUp(
      { lastHistoryEntryId: "e5", exactThrough: { index: 5, since: "e2" } },
      { id: "e7", index: 7 });
    getHistoryEntriesAfter.mockResolvedValue([entryDoc(6, "e5"), entryDoc(7, "e6")]);
    treeManager.setHistoryManager(historyManager);
    await historyManager.catchUpAtLoad();

    tileContent.setText("local");
    await setCalled.promise;

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ index: 8, previousEntryId: "e7" }));
  });
});
