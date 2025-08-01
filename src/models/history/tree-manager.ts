import {
  types, Instance, flow, IJsonPatch, detach, destroy, getSnapshot, toGenerator, addDisposer
} from "mobx-state-tree";
import { when } from "mobx";
import firebase from "firebase/app";
import { nanoid } from "nanoid";
import { TreeAPI } from "./tree-api";
import { IUndoManager, UndoStore } from "./undo-store";
import { TreePatchRecord, HistoryEntry, TreePatchRecordSnapshot,
  HistoryOperation,
  ICreateHistoryEntry} from "./history";
import { DEBUG_HISTORY } from "../../lib/debug";
import { getDocumentPath, getSimpleDocumentPath, IDocumentMetadata } from "../../../shared/shared";
import { Firestore } from "../../lib/firestore";
import { UserModelType } from "../stores/user";
import { UserContextProvider } from "../stores/user-context-provider";
import { getLastHistoryEntry, loadHistory } from "./history-firestore";

/**
 * Helper method to print objects in template strings
 * In console statements they can be "printed", just by adding them as extra
 * parameters.  But in error messages it is useful to do the same thing.
 *
 * @param value any object
 * @returns
 */
const json = (value: any) => JSON.stringify(value);

const FAKE_HISTORY_ENTRY_ID = "FAKE_HISTORY_ENTRY_ID";
const FAKE_EXCHANGE_ID = "FAKE_EXCHANGE_ID";

export const CDocument = types
.model("CDocument", {
  // TODO: switch to a map, so we get faster lookups in the map and MST can
  // do better at applying snapshots and patches by reusing existing
  // objects.
  history: types.array(HistoryEntry)
});
export interface CDocumentType extends Instance<typeof CDocument> {}

interface IFirestoreSavingProps {
  userContextProvider: UserContextProvider;
  firestore: Firestore;
}

interface IFirestoreHistoryInfo {
  documentPath: string;
  lastEntryIndex: number;
  lastEntryId: string | null;
}

interface IMainDocument extends TreeAPI {
  key: string;
  uid: string;
  metadata: IDocumentMetadata;
}

export enum HistoryStatus {
  HISTORY_ERROR,
  FINDING_HISTORY_LENGTH,
  NO_HISTORY,
  HISTORY_LOADED,
  HISTORY_LOADING,
}

export const TreeManager = types
.model("TreeManager", {
  document: CDocument,
  undoStore: UndoStore,
  // This is not volatile, so the TreeManager actions can modify it directly.
  // If it was volatile, it would be its own MST tree, and the actions in this
  // TreeManager model can not modify other MST trees.
  // When the history is serialized, we'll only serialize the CDocument, so it
  // shouldn't matter that these uncompleted history entries are part of the
  // state of the TreeManager.
  activeHistoryEntries: types.array(HistoryEntry)
})
.volatile(self => ({
  trees: {} as Record<string, TreeAPI>,
  // The number of history entries that have been applied to the document.
  // When replaying history this number can be less than the total number
  // history entries (self.document.history.length)
  numHistoryEventsApplied: 0 as number | undefined,
  loadingError: undefined as firebase.firestore.FirestoreError | undefined,
  mainDocument: undefined as IMainDocument | undefined,
  userContextProvider: undefined as UserContextProvider | undefined,
  firestore: undefined as Firestore | undefined,
  /**
   * The most recent historyEntryId of the document. If the document is restored
   * from a system that stores the revisionId, the revisionId can be restored.
   * However in that case, there might not be a corresponding history entry.
   */
  revisionId: ""
}))
.views((self) => ({
  get undoManager() : IUndoManager {
    return self.undoStore;
  },

  findHistoryEntry(historyEntryId: string) {
    return self.document.history.find(entry => entry.id === historyEntryId);
  },

  findHistoryEntryIndex(historyEntryId: string) {
    return self.document.history.findIndex(entry => entry.id === historyEntryId);
  },

  get latestDocumentHistoryEntry() {
    const history = self.document.history;
    return history ? history[history.length - 1] : undefined;
  },

  findActiveHistoryEntry(historyEntryId: string) {
    return self.activeHistoryEntries.find(entry => entry.id === historyEntryId);
  },

  get historyStatus() : HistoryStatus {
    if (self.loadingError) {
      return HistoryStatus.HISTORY_ERROR;
    }

    const historyLength = self.document.history.length;
    const {numHistoryEventsApplied} = self;
    if (numHistoryEventsApplied === undefined) {
      // We are waiting for the query to figure out the last history entry.
      return HistoryStatus.FINDING_HISTORY_LENGTH;
    } else {
      if (historyLength === 0 && numHistoryEventsApplied === 0) {
        return HistoryStatus.NO_HISTORY;
      } else {
        if (historyLength >= numHistoryEventsApplied) {
          return HistoryStatus.HISTORY_LOADED;
        } else {
          // In this case, the numHistoryEventsApplied tells us that we have more history
          // entries, but they haven't been loaded yet for some reason.
          // This might be an error, but more likely the history is still loading.
          return HistoryStatus.HISTORY_LOADING;
        }
      }
    }
  },
}))
.views(self => ({
  get historyStatusString() : string {
    switch (self.historyStatus) {
      case HistoryStatus.HISTORY_ERROR:
        return "Error loading history";
      case HistoryStatus.FINDING_HISTORY_LENGTH:
        return "Finding the length of the history.";
      case HistoryStatus.NO_HISTORY:
        return "This document has no history.";
      case HistoryStatus.HISTORY_LOADED:
        return "History is loaded";
      case HistoryStatus.HISTORY_LOADING: {
        const historyLength = self.document.history.length;
        const {numHistoryEventsApplied} = self;
        return `Loading history (${historyLength}/${numHistoryEventsApplied})`;
      }
      default:
        return "Unknown history status";
    }
  }
}))
.actions(self => {
  let firestoreHistoryInfoPromise: Promise<IFirestoreHistoryInfo> | undefined;

  function getFirestoreHistoryInfo(): Promise<IFirestoreHistoryInfo> {
    if (!firestoreHistoryInfoPromise) {
      firestoreHistoryInfoPromise = prepareFirestoreHistoryInfo(self);
    }

    return firestoreHistoryInfoPromise;
  }

  return {
    completeHistoryEntry(entry: Instance<typeof HistoryEntry>) {
      const {firestore} = self;
      entry.state = "complete";

      // Remove the entry from the activeHistoryEntries
      detach(entry);

      // If the history entry resulted in no changes don't add it to the real
      // history.
      //
      // TODO: we might not want to do this, it could be useful for researchers
      // and teachers to see actions the student took even if they didn't change
      // state. For example if a button was clicked even if it didn't change the
      // state we might want to show that somehow. There are lots of entries
      // that are empty though, so they are removed for the time being.
      if (entry.records.length === 0) {
        destroy(entry);
        return;
      }

      // Save the index in the local history. This is used to figure out
      // the index written into the firestore entry document
      const newLocalIndex = self.document.history.length;

      // Re-attach the entry to the actual history
      self.document.history.push(entry);

      // Add the entry to the undo stack if it is undoable.
      //
      // TODO: Is it best to wait until the entry is complete like this? It
      // might be better to add it earlier so it has the right position in the
      // undo stack. For example if a user action caused some async behavior
      // that takes a while, should its place in the stack be at the beginning
      // or end of these changes? As a downside, if we add it earlier the undo
      // stack will have incomplete entries in sometimes.
      if (entry.undoable) {
        self.undoStore.addHistoryEntry(entry);

        // Store the most recent undo-able history id.
        self.revisionId = entry.id;
      }

      if (!firestore) {
        // We might want to throw an error here to figure out when this happens.
        // Currently, when running the spec tests firestore is not setup, so it is
        // easier to just return and not try to save the history to Firestore.
        return;
      }

      // Create the document in firestore if necessary
      getFirestoreHistoryInfo().then(({documentPath, lastEntryIndex, lastEntryId}) => {
        // add a new document for this history entry
        const historyEntryPath = firestore.getFullPath(`${documentPath}/history`);

        const previousEntryLocalIndex = newLocalIndex - 1;
        const previousEntry = previousEntryLocalIndex >= 0 && self.document.history.at(previousEntryLocalIndex);
        const previousEntryId = previousEntry ? previousEntry.id : lastEntryId;

        const docRef = firestore.documentRef(historyEntryPath, entry.id);
        const snapshot = getSnapshot(entry);
        // If there was no last entry in Firestore getFirestoreHistoryInfo sets
        // lastEntryIndex to -1
        const index = lastEntryIndex + 1 + newLocalIndex;
        docRef.set({
          index,
          created: firestore.timestamp(),
          previousEntryId,
          entry: JSON.stringify(snapshot)
        });
      });
    }
  };
})
.actions((self) => ({
  setChangeDocument(cDoc: CDocumentType) {
    self.document = cDoc;
  },

  setRevisionId(revisionId: string) {
    self.revisionId = revisionId;
  },

  setLoadingError(error: firebase.firestore.FirestoreError) {
    self.loadingError = error;
  },

  setPropsForFirestoreSaving({userContextProvider, firestore}: IFirestoreSavingProps) {
    self.userContextProvider = userContextProvider;
    self.firestore = firestore;
  },

  setNumHistoryEntriesApplied(value: number) {
    self.numHistoryEventsApplied = value;
  },

  putTree(treeId: string, tree: TreeAPI) {
    self.trees[treeId] = tree;
  },

  startExchange(historyEntryId: string, exchangeId: string, name: string) {
    // Ignore fake history entries these are used when replaying history
    // to the tree
    if (historyEntryId === FAKE_HISTORY_ENTRY_ID) {
      return Promise.resolve();
    }

    // Find if there is already an entry with this historyEntryId
    const entry = self.findActiveHistoryEntry(historyEntryId);
    if (!entry) {
      throw new Error(`History Entry doesn't exist ${ json({historyEntryId})} `);
    }

    // Make sure this entry wasn't marked complete before
    if (entry.state === "complete") {
      throw new Error(`The entry was already marked complete ${ json({historyEntryId, exchangeId})}`);
    }

    // start a new open exchange with this exchangeId
    // Check if there is a open exchange already with this id:
    const activeExchangeValue = entry.activeExchanges.get(exchangeId);
    if (activeExchangeValue) {
      throw new Error("trying to create or update a history entry that has an existing open call");
    }
    entry.activeExchanges.set(exchangeId, name);
    return Promise.resolve();
  },

  endExchange(entry: Instance<typeof HistoryEntry>, exchangeId: string) {
    const openExchangeValue = entry.activeExchanges.get(exchangeId);
    if (!openExchangeValue) {
      throw new Error(`There is no active exchange matching ${ json({historyEntryId: entry.id, exchangeId}) }`);
    }

    entry.activeExchanges.delete(exchangeId);

    // TODO: We could use autorun for watching this observable map instead of
    // changing the entry state here.
    if (entry.activeExchanges.size === 0) {
      self.completeHistoryEntry(entry);
    }
  },

  createHistoryEntry(entryInfo: ICreateHistoryEntry) {
    const {id: historyEntryId, exchangeId, action} = entryInfo;
    if (self.findHistoryEntry(historyEntryId) || self.findActiveHistoryEntry(historyEntryId)) {
      throw new Error(`The entry already exists ${ json({historyEntryId})}`);
    }
    const entry = HistoryEntry.create({
      ...entryInfo,
    });
    self.activeHistoryEntries.push(entry);

    entry.activeExchanges.set(exchangeId, `TreeManager.createHistoryEntry ${action}`);

    return entry;
  },

  setNumHistoryEntriesAppliedFromFirestore: flow(
    function *setNumHistoryEntriesAppliedFromFirestore(firestore: Firestore, docPath: string) {
      // clear the numHistoryEventsApplied so it is obvious when it is filled in
      self.numHistoryEventsApplied = undefined;

      const lastHistoryEntry = yield* toGenerator(getLastHistoryEntry(firestore, docPath));
      if (lastHistoryEntry) {
        self.numHistoryEventsApplied = lastHistoryEntry.index + 1;
      } else {
        // If there is no entry then we have an empty document
        self.numHistoryEventsApplied = 0;
      }
    }
  ),

}))
.actions((self) => ({
  // Using async actions is generally not a good idea, because the changes will not be grouped into
  // a single action for any action-tracking middleware. However, in this case we aren't recording the
  // actions of the TreeManager.
  async mirrorHistoryFromFirestore(user: UserModelType, firestore: Firestore) {
    // FIXME-HISTORY: we should protect active documents so that if
    // mirrorHistoryFromFirestore is accidentally called on their treeManager
    // we don't replace their history. Probably the best approach is
    // adding a prop to documents so we can identify documents that are being
    // used for history replaying
    // https://www.pivotaltracker.com/story/show/183291353

    const documentKey = self.mainDocument?.key;
    const userId = self.mainDocument?.uid;
    if (!documentKey || !userId) {
      console.warn("mirrorHistoryFromFirestore, requires a mainDocument");
      return;
    }

    const network = userId === user.id ? user.network : undefined;
    const prefixedDocumentPath = getDocumentPath(userId, documentKey, network);
    const simpleDocumentPath = getSimpleDocumentPath(documentKey);
    const prefixedDocSnapshot = await firestore.doc(prefixedDocumentPath).get();
    const docPath = prefixedDocSnapshot.exists ? prefixedDocumentPath : simpleDocumentPath;

    self.setNumHistoryEntriesAppliedFromFirestore(firestore, docPath);

    // TODO: We are not checking if the parent document of the history entries actually
    // exists before getting the history collection below it.
    // If this parent document doesn't exist the history won't exist.
    // Also if this document doesn't exist then probably the query of the
    // history will fail. I think this approach is OK, but we should
    // check what happens if history is opened on a document that doesn't
    // have a parent document.

    const snapshotUnsubscribe = loadHistory(firestore, `${docPath}/history`,
      (history, error) => {
        if (error) {
          self.setLoadingError(error);
        } else {
          const cDocument = CDocument.create({history});
          self.setChangeDocument(cDocument);
        }
      }
    );
    addDisposer(self, snapshotUnsubscribe);
  },

  setMainDocument(document: IMainDocument) {
    self.mainDocument = document;
    self.putTree(document.key, document);
  },

  updateSharedModel(historyEntryId: string, exchangeId: string, sourceTreeId: string, snapshot: any): Promise<void> {
    // Right now this can be called in 2 cases:
    // 1. when a user changes something in a tree which then updates the
    //    tree's view of the shared model, so the tree wants all copies of
    //    this shared model to be updated.
    // 2. when a user undoes or redoes an action that affects the shared model.
    //    In this case the tree owning the shared model calls updateSharedModel to send
    //    these changes to all of the other trees.
    //
    // If we support trees/tiles having customized views of shared models then this
    // will need to become more complex.
    const applyPromises = Object.entries(self.trees).map(([treeId, tree]) => {
      if (treeId === sourceTreeId) {
        return;
      }

      // In case #1 the passed in exchangeId comes from the action that updated
      // the shared model view in the tree. This exchangeId will be closed by the
      // tree after updateSharedModel is called. updateSharedModel will be
      // waited for, so it should not be possible for the historyEntry to be
      // closed before this new exchangeId is setup. So really we don't need the
      // exchangeId to be passed, but it can be useful for debugging.
      //
      // TODO: how is exchangeId handled in case #2?
      const applyExchangeId = nanoid();
      self.startExchange(historyEntryId, applyExchangeId, "updateSharedModel.apply");
      return tree.applySharedModelSnapshotFromManager(historyEntryId, applyExchangeId, snapshot);
    });
    // The contract for this method is to return a Promise<void> so we cast the result here.
    return Promise.all(applyPromises).then();
  },

  addHistoryEntry(entryInfo: ICreateHistoryEntry) {
    self.createHistoryEntry(entryInfo);
    return Promise.resolve();
  },

  addTreePatchRecord(historyEntryId: string, exchangeId: string,
    record: TreePatchRecordSnapshot) {

    if (historyEntryId === FAKE_HISTORY_ENTRY_ID) {
      // In this case we don't want to save anything. This is currently used when
      // replaying the history to the tree
      return;
    }

    const treePatchRecord = TreePatchRecord.create(record);

    // Find if there is already an entry with this historyEntryId
    const entry = self.findActiveHistoryEntry(historyEntryId);
    if (!entry) {
      throw new Error(`There isn't an active entry for ${ json({historyEntryId, exchangeId})}`);
    }

    // Make sure this entry wasn't marked complete before
    if (entry.state === "complete") {
      throw new Error(`The entry was already marked complete ${ json({historyEntryId, exchangeId})}`);
    }

    // The tree patch record will be sent even if there are no patches.
    // This is how the tree tells the manager that this exchangeId is closed.
    if (treePatchRecord.patches.length > 0) {
      entry.records.push(treePatchRecord);
    }

    if (DEBUG_HISTORY) {
      // eslint-disable-next-line no-console
      console.log("addTreePatchRecord",
        { action: record.action, historyEntryId, exchangeId,
          exchangeName: entry.activeExchanges.get(exchangeId)});
    }

    self.endExchange(entry, exchangeId);
  },

  /**
   * Replay the whole history to the trees.
   *
   * This should not record this "replay" into the history again
   */
  replayHistoryToTrees: flow(function* replayHistoryToTrees() {
    const trees = Object.values(self.trees);

    // Disable shared model syncing on all of the trees. This is
    // different than when the undo store applies patches because in
    // this case we are going to apply lots of history entries all at
    // once. We use FAKE ids here so any responses from tree are
    // not recorded in the history.
    const startPromises = trees.map(tree => {
      return tree.startApplyingPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID);
    });
    yield Promise.all(startPromises);

    // apply the patches to all trees

    // iterate document.history This code groups all of the patches for a
    // particular tree into one array. This batching is done
    // for performance.
    //
    // However, this single array of changes might be a problem for large
    // documents so we might have to split the array into pages, and send
    // information about the order of the pages so the tree receiving them can
    // make sure it is getting them in the right order.
    //
    const treePatches: Record<string, IJsonPatch[] | undefined> = {};
    Object.keys(self.trees).forEach(treeId => treePatches[treeId] = []);

    self.document.history.forEach(entry => {
      entry.records.forEach(treeEntry => {
        const patches = treePatches[treeEntry.tree];
        patches?.push(...treeEntry.patches);
      });
    });

    const applyPromises = Object.entries(treePatches).map(([treeId, patches]) => {
      if (patches && patches.length > 0) {
        const tree = self.trees[treeId];
        return tree?.applyPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID, patches);
      }
    });
    yield Promise.all(applyPromises);

    // finish the patch application
    // Need to tell all of the tiles to re-enable the sync and run the sync
    // to resync their tile models with any changes applied to the shared models
    // For this final step, we still use promises so we can wait for everything to complete.
    // This can be used in the future to make sure multiple applyPatchesToTrees are not
    // running at the same time.
    const finishPromises = trees.map(tree => {
      return tree.finishApplyingPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID);
    });
    yield Promise.all(finishPromises);

    // TODO: if the tree/tile is written wrong, there might be some changes
    // that come in with a fake entry after finishApplyingPatchesFromManager.
    // This is because the changes might trigger updateTreeAfterSharedModelChanges
    // and that will happen async. With some work we should be able to identify this
    // and print a warning to the console.
    // One way might be using unique history_entry_ids that we mark as closed
    // after the finish call.
  }),

  goToHistoryEntry: flow(function* goToHistoryEntry(
                                      newHistoryPosition: number) {
    const trees = Object.values(self.trees);

    if (newHistoryPosition === self.numHistoryEventsApplied) return;
    if (self.numHistoryEventsApplied === undefined) return;
    // Disable shared model syncing on all of the trees. This is
    // different than when the undo store applies patches because in
    // this case we are going to apply lots of history entries all at
    // once. We use FAKE ids here so any responses from tree are
    // not recorded in the history.
    const startPromises = trees.map(tree => {
      return tree.startApplyingPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID);
    });
    yield Promise.all(startPromises);

    const treePatches: Record<string, IJsonPatch[] | undefined> = {};
    Object.keys(self.trees).forEach(treeId => treePatches[treeId] = []);

    // direction tells us which direction to go
    // startingIndex and endingIndex are so we don't add the currentHistoryEvent into patches
    // because we are going to assume that it has already been played, and we don't want to play it
    // again if we are going forward.
    const direction = newHistoryPosition > self.numHistoryEventsApplied ? 1 : -1;
    const startingIndex = direction === 1 ? self.numHistoryEventsApplied : self.numHistoryEventsApplied - 1;
    const endingIndex = direction === 1 ? newHistoryPosition : newHistoryPosition - 1;
    for (let i=startingIndex; i !== endingIndex; i=i+direction) {
      const historyEntry = self.document.history.at(i);
      let records = historyEntry ? [ ...historyEntry.records] : [];
      if (direction === -1) {
        records = records.reverse();
      }
      for (const entryRecord of records) {
        const patches = treePatches[entryRecord.tree];
        if (newHistoryPosition > self.numHistoryEventsApplied) {
          patches?.push(...entryRecord.getPatches(HistoryOperation.Redo));
        } else {
          patches?.push(...entryRecord.getPatches(HistoryOperation.Undo));
        }
      }
    }

    const applyPromises = Object.entries(treePatches).map(([treeId, patches]) => {
      if (patches && patches.length > 0) {
        const tree = self.trees[treeId];
        return tree?.applyPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID, patches);
      }
    });
    yield Promise.all(applyPromises);

    // finish the patch application
    // Need to tell all of the tiles to re-enable the sync and run the sync
    // to resync their tile models with any changes applied to the shared models
    // For this final step, we still use promises so we can wait for everything to complete.
    // This can be used in the future to make sure multiple applyPatchesToTrees are not
    // running at the same time.
    const finishPromises = trees.map(tree => {
      return tree.finishApplyingPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID);
    });
    yield Promise.all(finishPromises);

    // TODO: if the tree/tile is written wrong, there might be some changes
    // that come in with a fake entry after finishApplyingPatchesFromManager.
    // This is because the changes might trigger updateTreeAfterSharedModelChanges
    // and that will happen async. With some work we should be able to identify this
    // and print a warning to the console.
    // One way might be using unique history_entry_ids that we mark as closed
    // after the finish call.
    self.numHistoryEventsApplied = newHistoryPosition;
  })
}))
.actions((self) => ({
  async moveToHistoryEntryAfterLoad(historyId: string) {
    await when(() => self.historyStatus === HistoryStatus.HISTORY_LOADED);
    const entry = self.findHistoryEntryIndex(historyId);
    if (entry >= 0) {
      self.goToHistoryEntry(entry);
    } else {
      console.warn("Did not find history entry with id: ", historyId);
    }
  }
}))
.views(self => ({
  getHistoryEntry: (historyIndex: number) => {
    return self.document.history.at(historyIndex);
  }
}))
.views(self => ({
  get currentHistoryEntry() {
    const index = self.numHistoryEventsApplied ?? 0;
    return index > 0 ? self.getHistoryEntry(index - 1) : undefined;
  }
}));

export interface TreeManagerType extends Instance<typeof TreeManager> {}

interface IPrepareFirestoreHistoryInfoArgs {
  userContextProvider?: UserContextProvider;
  mainDocument?: IMainDocument;
  firestore?: Firestore;
}

async function prepareFirestoreHistoryInfo(
    {userContextProvider, mainDocument, firestore}: IPrepareFirestoreHistoryInfoArgs): Promise<IFirestoreHistoryInfo> {
  // TODO: Wait for userContext to be valid.
  // The userContext initially starts out with a user id of 0 and doesn't have a portal and other
  // properties defined. After the user is authenticated the userContext will have valid fields.
  // The invalid userContext will cause an error below. So we should use something like a MobX
  // `await when(() => userContext?.uid)`. So far we haven't seen a case where
  // prepareFirestoreHistoryInfo is called before the userContext is ready.
  const userContext = userContextProvider?.userContext;

  if (!userContextProvider || !mainDocument || !firestore || !userContext?.uid) {
    console.error("cannot record history entry because environment is not valid",
      { userContext, mainDocument, firestore });
    throw new Error("cannot record history entry because environment is not valid");
  }

  const prefixedDocumentPath = getDocumentPath(userContext.uid, mainDocument.key, userContext.network);
  let documentPath = getSimpleDocumentPath(mainDocument.key);
  const prefixedDocumentRef = firestore.doc(prefixedDocumentPath);
  const documentRef = firestore.doc(documentPath);
  const prefixedDocSnapshot = await prefixedDocumentRef.get();

  // Prefixed documents are legacy documents and won't be created anymore. We create simple (unprefixed) documents
  // automatically. If a prefixed document already exists, we want to use that because it contains history that
  // we want to append to.
  // TODO: Migrate prefixed documents to simple documents and remove prefixed document handling code.
  if (!prefixedDocSnapshot.exists) {
    // The metadata documents are created by DB#createDocument however it does not wait for the metadata
    // document to be created. So we might end up here before the metadata document has been created.
    // DB#createDocument will create simple, unprefixed documents even if a prefixed document already exists.
    await new Promise<void>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined = undefined;
      const disposer = documentRef.onSnapshot(doc => {
        if (doc.exists) {
          resolve();
          if (timeoutId) {
            disposer();
            clearTimeout(timeoutId);
          }
        }
      });
      timeoutId = setTimeout(() => {
        // If there isn't a firestore metadata document in 5 seconds then give up
        disposer();
        console.warn("Could not find metadata document to attach history to", documentPath);
        // If there is an error here the history will not be saved for the duration
        // of this CLUE session.
        // This happens because the rejection will bubble up to completeHistoryEntry.
        // That does not handle errors from this promise. The "then" function will
        // not be called. The error should be printed as an unhandled promise error.
        // The next time a history entry is "completed" this rejected promise
        // will be "then'd" again which will again not run its function.
        // TODO: consider updating this to create the metadata document itself by
        // calling createFirestoreMetadataDocument.
        reject(`Could not find metadata document to attach history to ${documentPath}`);
      }, 5000);
    });
  } else {
    documentPath = prefixedDocumentPath;
  }

  const lastHistoryEntry = await getLastHistoryEntry(firestore, documentPath);

  return {
    documentPath,
    // We start with -1 so if there is no last entry the next entry will get an index of 0
    // 0 is a valid index so ?? must be used instead of ||
    lastEntryIndex: lastHistoryEntry?.index ?? -1,
    // We use null here so this is a valid Firestore property value
    lastEntryId: lastHistoryEntry?.id || null
  };
}
