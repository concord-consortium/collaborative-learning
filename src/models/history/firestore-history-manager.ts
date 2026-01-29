import { action, computed, makeObservable, observable, runInAction, when } from "mobx";
import { addDisposer, getSnapshot, Instance, applySnapshot, IJsonPatch } from "mobx-state-tree";
import firebase from "firebase/app";
import { getSimpleDocumentPath, IDocumentMetadata } from "../../../shared/shared";
import { Firestore } from "../../lib/firestore";
import { typeConverter } from "../../utilities/db-utils";
import { UserContextProvider } from "../stores/user-context-provider";
import { getLastHistoryEntry, loadFirestoreHistory, loadHistory } from "./history-firestore";
import { CDocument, CDocumentType, FAKE_EXCHANGE_ID, FAKE_HISTORY_ENTRY_ID, TreeManagerType } from "./tree-manager";
import { HistoryEntry, HistoryEntrySnapshot, HistoryEntryType, HistoryOperation } from "./history";

interface IFirestoreHistoryInfo {
  documentPath: string;
  lastEntryIndex: number;
  lastEntryId: string | null;
}

export enum HistoryStatus {
  HISTORY_ERROR,
  FINDING_HISTORY_LENGTH,
  NO_HISTORY,
  HISTORY_LOADED,
  HISTORY_LOADING,
}

export interface IFirestoreHistoryManagerArgs {
  firestore: Firestore;
  userContextProvider: UserContextProvider;
  treeManager: TreeManagerType;
  uploadLocalHistory: boolean;
  syncRemoteHistory: boolean;
}

/**
 * Manages saving history entries to Firestore for a document. In the future this class may
 * also manage loading history entries from Firestore.
 *
 * In the future there might be a subclass which handles documents being edited by multiple
 * users at the same time.
 */
export class FirestoreHistoryManager {
  firestore: Firestore;
  userContextProvider: UserContextProvider;
  treeManager: TreeManagerType;
  uploadLocalHistory: boolean;
  loadingError = undefined as firebase.firestore.FirestoreError | undefined;

  constructor({
    firestore,
    userContextProvider,
    treeManager,
    uploadLocalHistory,
    syncRemoteHistory
  }: IFirestoreHistoryManagerArgs) {
    this.firestore = firestore;
    this.userContextProvider = userContextProvider;
    this.treeManager = treeManager;
    this.uploadLocalHistory = uploadLocalHistory;

    if (syncRemoteHistory) {
      this.mirrorHistoryFromFirestore();
    }

    // We want computed properties like historyStatus to be observable
    makeObservable(this, {
      loadingError: observable,
      setLoadingError: action,
      historyStatus: computed,
      historyStatusString: computed
    });
  }

  setLoadingError(error: firebase.firestore.FirestoreError) {
    this.loadingError = error;
  }

  /**
   * Waits for the Firestore metadata document to exist at the specified path.
   * The creation of the Firestore metadata document should have already been started by
   * DB#createDocument. However createDocument does not wait for the metadata to actually exist.
   * So here, we wait up to 5 seconds for this metadata document to exist.
   */
  async waitForMetadataDocument(documentPath: string) {
    const documentRef = this.firestore.doc(documentPath);

    const timeoutForMetadataMs = 5000;
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
        // This happens because the rejection will bubble up to onHistoryEntryCompleted.
        // That does not handle errors from this promise. It will throw an exception.
        // The error should be printed as an unhandled promise error.
        // This rejected promise should now be stored in firestoreHistoryInfoPromise
        // The next time a history entry is "completed" this rejected promise will be awaited
        // again which should throw the same exception again.
        // TODO: consider updating this to create the metadata document itself by
        // calling createFirestoreMetadataDocument.
        // TODO: if this kind of error results in lots of "unhandled promise errors" shown
        // in the console, explicity disable firestore saving after the first error.
        reject(`Could not find metadata document to attach history to ${documentPath}`);
      }, timeoutForMetadataMs);
    });
  }

  async prepareFirestoreHistoryInfo(): Promise<IFirestoreHistoryInfo> {
    const { userContextProvider, treeManager: { mainDocument }, firestore } = this;
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

    // Get the path to the Firestore metadata document that will be the parent of the history entries
    const documentPath = getSimpleDocumentPath(mainDocument.key);
    await this.waitForMetadataDocument(documentPath);

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

  firestoreHistoryInfoPromise: Promise<IFirestoreHistoryInfo> | undefined;

  async getFirestoreHistoryInfo() : Promise<IFirestoreHistoryInfo> {
    if (!this.firestoreHistoryInfoPromise) {
      this.firestoreHistoryInfoPromise = this.prepareFirestoreHistoryInfo();
    }
    return this.firestoreHistoryInfoPromise;
  }

  async onHistoryEntryCompleted(
    historyContainer: CDocumentType,
    entry: Instance<typeof HistoryEntry>,
    newLocalIndex: number
  ) {
    // Skip uploading if uploadLocalHistory is false (e.g., playback documents)
    if (!this.uploadLocalHistory) {
      return;
    }

    // The parent Firestore metadata document might not be ready yet so we need to wait for that.
    // We also need to wait for the last history entry to be known so we know what index to assign
    const { documentPath, lastEntryIndex, lastEntryId } = await this.getFirestoreHistoryInfo();
    const { firestore } = this;

    // add a new document for this history entry
    const historyEntryPath = firestore.getFullPath(`${documentPath}/history`);

    const previousEntryLocalIndex = newLocalIndex - 1;
    const previousEntry = previousEntryLocalIndex >= 0 && historyContainer.history.at(previousEntryLocalIndex);
    const previousEntryId = previousEntry ? previousEntry.id : lastEntryId;

    const docRef = firestore.documentRef(historyEntryPath, entry.id);
    const snapshot = getSnapshot(entry);

    // If there was no last entry in Firestore, prepareFirestoreHistoryInfo sets
    // lastEntryIndex to -1
    const index = lastEntryIndex + 1 + newLocalIndex;
    docRef.set({
      index,
      created: firestore.timestamp(),
      previousEntryId,
      entry: JSON.stringify(snapshot)
    });
  }

  get historyStatus() : HistoryStatus {
    if (this.loadingError) {
      return HistoryStatus.HISTORY_ERROR;
    }

    const historyLength = this.treeManager.document.history.length;
    const {numHistoryEventsApplied} = this.treeManager;
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
  }

  get historyStatusString() : string {
    switch (this.historyStatus) {
      case HistoryStatus.HISTORY_ERROR:
        return "Error loading history";
      case HistoryStatus.FINDING_HISTORY_LENGTH:
        return "Finding the length of the history.";
      case HistoryStatus.NO_HISTORY:
        return "This document has no history.";
      case HistoryStatus.HISTORY_LOADED:
        return "History is loaded";
      case HistoryStatus.HISTORY_LOADING: {
        const historyLength = this.treeManager.document.history.length;
        const {numHistoryEventsApplied} = this.treeManager;
        return `Loading history (${historyLength}/${numHistoryEventsApplied})`;
      }
      default:
        return "Unknown history status";
    }
  }

  async moveToHistoryEntryAfterLoad(historyId: string) {
    await when(() => this.historyStatus === HistoryStatus.HISTORY_LOADED);
    const entry = this.treeManager.findHistoryEntryIndex(historyId);
    if (entry >= 0) {
      this.treeManager.goToHistoryEntry(entry);
    } else {
      console.warn("Did not find history entry with id: ", historyId);
    }
  }

  async mirrorHistoryFromFirestore() {
    const { treeManager, firestore } = this;
    const { mainDocument } = treeManager;

    const documentKey = mainDocument?.key;
    const userId = mainDocument?.uid;
    if (!documentKey || !userId) {
      console.warn("mirrorHistoryFromFirestore, requires a mainDocument");
      return;
    }

    // Wait for the parent document to exist
    let documentPath: string;
    try {
      const firestoreHistoryInfo = await this.prepareFirestoreHistoryInfo();
      documentPath = firestoreHistoryInfo.documentPath;
    } catch (error) {
      // The metadata document doesn't exist or there was another error.
      // Set the loading error so historyStatus returns HISTORY_ERROR.
      this.setLoadingError({
        message: error instanceof Error ? error.message : String(error)
      } as firebase.firestore.FirestoreError);
      return;
    }

    // TODO: we should move this function into the history manager
    treeManager.setNumHistoryEntriesAppliedFromFirestore(firestore, documentPath);

    const snapshotUnsubscribe = loadHistory(firestore, `${documentPath}/history`,
      (history, error) => {
        if (error) {
          this.setLoadingError(error);
        } else {
          // TODO: When run on every change for a collaborative document this will
          // be pretty inefficient since it is recreating the whole CDocument
          // each time. We can improve this by using Firestore's snapshot.docChanges()
          // method. This way can just add the new history entries.

          // If we apply the changes to the existing document in the treeManager
          // They will have the applied flag set to false if they are not already local
          // events that have been applied.
          // So after we do this, we should call an async function to apply any
          // unapplied history entries. Or we can use a reaction to do this automatically.

          if (!treeManager.document) {
            const cDocument = CDocument.create({history});
            treeManager.setChangeDocument(cDocument);
          } else {
            // FIXME: this is being called twice for a single change in the document.
            // Perhaps this is because both the initial local change and then a second
            // remote change.
            // I've confirmed there are not multiple listeners being created.
            console.log("Applying remote history update", {
              length: history.length,
              documentKey,
              newHistory: history,
              existingHistory: getSnapshot(treeManager.document.history)
            });
            // here is where the existing history entries should be preserved and just new ones added
            // FIXME: what is happening is that when a user makes several changes quickly, they get added
            // to local history right away. But then remote history comes in after the first of those changes
            // is uploaded to Firestore. So now this incomplete remote history overwrite the local history
            // including the local changes that have not yet been uploaded.
            //
            // So to fix this maybe it'd work to not use applySnapshot but instead do a merge operation
            // where we always preserve the local entries and just add the remote ones.
            //
            // Alternatively we could try to upload the local entries in a batch right away instead of doing one
            // at a time. This would require changing the onHistoryEntryCompleted to batch up multiple entries
            // somehow.
            //
            // Another option would be to keep the local and remote history in separate lists.
            // Or maybe not even store the remote history. Just do the "applied" check for each remote history
            // entry that comes in.
            //
            // This approach means that we can't just do "mirrorHistoryFromFirestore" combined with writing
            // history to get a collaborative document.
            applySnapshot(treeManager.document, {history});
          }
        }
      }
    );
    // Add this disposer so our Firestore listener is removed when the treeManager is destroyed
    addDisposer(treeManager, snapshotUnsubscribe);
  }
}

export class FirestoreHistoryManagerConcurrent extends FirestoreHistoryManager {

  completedHistoryEntryQueue: Array<HistoryEntryType> = [];
  uploadInProgress = false;
  /**
   * Stop uploading history entries from Firestore temporarily.
   */
  paused = false;

  constructor(args: IFirestoreHistoryManagerArgs) {
    super(args);
    // Make paused observable so UI can react to changes
    makeObservable(this, {
      paused: observable,
      pauseUploads: action,
      resumeUploadsAfterDelay: action,
    });
  }

  pauseUploads() {
    this.paused = true;
  }

  resumeUploadsAfterDelay(delayMs: number) {
    setTimeout(() => {
      runInAction(() => {
        this.paused = false;
      });
      this.uploadQueuedHistoryEntries();
    }, delayMs);
  }

  // FIXME: when a document is opened that already has content in it, and it has history
  // this history will get re-applied to the document. It is likely that this is reason
  // we see duplicate tiles when loading a group document
  async mirrorHistoryFromFirestore() {
    const { treeManager, firestore } = this;
    const { mainDocument } = treeManager;

    const documentKey = mainDocument?.key;
    const userId = mainDocument?.uid;
    if (!documentKey || !userId) {
      console.warn("mirrorHistoryFromFirestore, requires a mainDocument");
      return;
    }

    // Wait for the parent document to exist
    let documentPath: string;
    try {
      const firestoreHistoryInfo = await this.prepareFirestoreHistoryInfo();
      documentPath = firestoreHistoryInfo.documentPath;
    } catch (error) {
      // The metadata document doesn't exist or there was another error.
      // Set the loading error so historyStatus returns HISTORY_ERROR.
      this.setLoadingError({
        message: error instanceof Error ? error.message : String(error)
      } as firebase.firestore.FirestoreError);
      return;
    }

    // TODO: probably we can just delete this from the concurrent manager
    treeManager.setNumHistoryEntriesAppliedFromFirestore(firestore, documentPath);

    const snapshotUnsubscribe = loadFirestoreHistory(firestore, `${documentPath}/history`,
      (historyEntryDocs, error) => {
        if (error) {
          this.setLoadingError(error);
        } else {
          // TODO: When run on every change for a collaborative document this will
          // be pretty inefficient since it is recreating the whole CDocument
          // each time. We can improve this by using Firestore's snapshot.docChanges()
          // method. This way can just add the new history entries.

          // If we apply the changes to the existing document in the treeManager
          // They will have the applied flag set to false if they are not already local
          // events that have been applied.
          // So after we do this, we should call an async function to apply any
          // unapplied history entries. Or we can use a reaction to do this automatically.

          if (!treeManager.document) {
            // If there is no change document yet it seems like it should be an error
            // We are only working on documents that are editable. So they should have
            // a change document created automatically. However perhaps it doesn't get
            // created until the first entry shows up?
            // For now just throw an error so we can figure out if this case happens.
            throw new Error("mirrorHistoryFromFirestore: no change document exists yet");
            // If we need to create the change document here, we can use this code:
            // treeManager.setChangeDocument(CDocument.create({history: []}));
          }

          // FIXME: this is being called twice for a single change in the document.
          // Perhaps this is because both the initial local change and then a second
          // remote change.
          // I've confirmed there are not multiple listeners being created.
          const existingHistory = treeManager.document.history;

          console.log("Applying remote concurrent history update", {
            length: historyEntryDocs.length,
            documentKey,
            newHistoryEntryDocs: historyEntryDocs,
            existingHistory: getSnapshot(existingHistory)
          });

          // here is where the existing history entries should be preserved and just new ones added
          // FIXME: what is happening is that when a user makes several changes quickly, they get added
          // to local history right away. But then remote history comes in after the first of those changes
          // is uploaded to Firestore. So now this incomplete remote history overwrite the local history
          // including the local changes that have not yet been uploaded.
          //
          // So to fix this maybe it'd work to not use applySnapshot but instead do a merge operation
          // where we always preserve the local entries and just add the remote ones.
          //
          // Alternatively we could try to upload the local entries in a batch right away instead of doing one
          // at a time. This would require changing the onHistoryEntryCompleted to batch up multiple entries
          // somehow.
          //
          // Another option would be to keep the local and remote history in separate lists.
          // Or maybe not even store the remote history. Just do the "applied" check for each remote history
          // entry that comes in.
          //
          // This approach means that we can't just do "mirrorHistoryFromFirestore" combined with writing
          // history to get a collaborative document.

          // Not the most efficient but lets get the history entries from the historyEntryDocs
          const incomingHistory: HistoryEntrySnapshot[] = historyEntryDocs.map(doc => {
            return JSON.parse(doc.entry) as HistoryEntrySnapshot;
          });

          // Again not the most efficient to figure out which entries are new
          const newEntries: HistoryEntrySnapshot[] = [];
          for (const entry of incomingHistory) {
            const exists = existingHistory.find(e => e.id === entry.id);
            if (!exists) {
              newEntries.push(entry);
            }
          }

          this.applyHistoryEntries(newEntries);
        }
      }
    );
    // Add this disposer so our Firestore listener is removed when the treeManager is destroyed
    addDisposer(treeManager, snapshotUnsubscribe);
  }


  async prepareFirestoreHistoryInfo(): Promise<IFirestoreHistoryInfo> {
    const { userContextProvider, treeManager: { mainDocument }, firestore } = this;
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

    // Get the path to the Firestore metadata document that will be the parent of the history entries
    const documentPath = getSimpleDocumentPath(mainDocument.key);
    await this.waitForMetadataDocument(documentPath);

    return {
      documentPath,
      // We need to return these properties to be compatible with the parent class.
      // We just return hardcoded values which are not actually used.
      // The actual values are read from Firestore on each onHistoryEntryCompleted.
      lastEntryIndex: -1,
      lastEntryId: null
    };
  }

  async onHistoryEntryCompleted(
    historyContainer: CDocumentType,
    entry: Instance<typeof HistoryEntry>,
    newLocalIndex: number
  ) {
    // Multiple entries can piled up, while some are being uploaded. A simple promise system
    // doesn't guarantee that the uploads will happen in order. So a queue is used.
    //
    // There are a few reasons why they might pile up:
    // - the entries could come in faster than they can be saved to Firestore.
    // - the metadata document might not be ready yet, so they'll be waiting
    // on the firestoreInfoPromise above. Once that resolves the first one will start running
    // however it will then stop running again while waiting fro the read in the transaction.
    // That will then let the second onHistoryEntryCompleted call to start running again.
    // I don't think there is a guarantee which of the blocked read calls will resolve first.
    // So the second onHistoryEntryCompleted might go first, which will then give it a wrong
    // index and previous entry id.
    this.completedHistoryEntryQueue.push(entry);
    this.uploadQueuedHistoryEntries();
  }

  async uploadQueuedHistoryEntries() {
    // If there is an inprogress we just return. The next uploadQueuedHistoryEntries
    // call will happen after the current upload finishes (at the end of this function).
    if (this.uploadInProgress) {
      return;
    }

    // If we are paused, return without uploading anything.
    // The next uploadQueuedHistoryEntries call will happen when resumeUploadsAfterDelay is called.
    if (this.paused) {
      return;
    }
    this.uploadInProgress = true;

    // The parent Firestore metadata document might not be ready yet so we need to wait for that.
    if (!this.firestoreHistoryInfoPromise) {
      this.firestoreHistoryInfoPromise = this.prepareFirestoreHistoryInfo();
    }
    const { documentPath: relativeMetadataPath } = await this.firestoreHistoryInfoPromise;
    const { firestore } = this;

    // add a new document for this history entry
    const metadataPath = firestore.getFullPath(relativeMetadataPath);
    const historyEntriesPath = `${metadataPath}/history`;

    // The following code is run in a Firestore transaction. This is so index and previousEntryId
    // are consistent even when multiple users are updating the history at the same time.
    // Without the transaction two users writing a new history entry at the same time would
    // both set the same index and previousEntryId which would corrupt the history.
    //
    // In order to do this we need to store a last history index and last history entry id
    // in the metadata document. Firestore transactions cannot run queries, so we cannot just
    // get the last history entry by querying the history collection for the highest index.
    //
    // Additionally firestore transactions work by just retrying the transaction code if any
    // documents being read are updated by some other client before the write operations are
    // finished. Because of this there cannot be side effects in the transaction code,
    // just reads and writes.
    //
    // Firestore has a limit of 500 operations per transaction, and 10 MiB for all transfered data.
    // To be safe we put a limit of uploading 20 entries a time.
    const MAX_ENTRIES_PER_TRANSACTION = 20;
    const entriesToUpload = this.completedHistoryEntryQueue.slice(0, MAX_ENTRIES_PER_TRANSACTION);
    if (entriesToUpload.length === 0) {
      // Nothing to do
      this.uploadInProgress = false;
      return;
    }
    await firestore.runTransaction(async (transaction) => {

      const converter = typeConverter<IDocumentMetadata>();
      const metadataDoc = await transaction.get(firestore.documentRef(metadataPath).withConverter(converter));

      if (!metadataDoc.exists) {
        // The metadata document must exist because we waited for it above
        throw new Error("Could not get metadata document in history transaction");
      }

      const metadata = metadataDoc.data();
      if (!metadata) {
        throw new Error("Could not get metadata document data in history transaction");
      }

      const lastEntry = metadata.lastHistoryEntry;
      let lastEntryIndex = lastEntry?.index ?? -1;
      let lastEntryId = lastEntry?.id ?? null;

      // TODO: if we want to migrate existing documents to this approach then if there is no lastHistoryEntry
      // we need to look through the existing history entries. We can't do that in a transaction
      // though. So we would need to do that before starting the transaction.
      // This migration would not be safe if there are multiple clients writing history at the same time.
      // The plan is to just use this for new group documents, so if there is some lost history
      // for existing group documents that is OK.


      // TODO: if there are lot of entries in the queue we need to limit how many we upload at once
      entriesToUpload.forEach(entry => {
        const newEntryIndex = lastEntryIndex + 1;

        const docRef = firestore.documentRef(historyEntriesPath, entry.id);
        const snapshot = getSnapshot(entry);

        transaction.set(docRef, {
          index: newEntryIndex,
          created: firestore.timestamp(),
          previousEntryId: lastEntryId,
          entry: JSON.stringify(snapshot)
        });
        lastEntryIndex = newEntryIndex;
        lastEntryId = entry.id;
      });

      transaction.update(firestore.documentRef(metadataPath), {
        lastHistoryEntry: {
          index: lastEntryIndex,
          id: lastEntryId
        }
      });
    });

    // Clear the queue now that all entries have been uploaded
    // But if there were new entries added while the transaction was running
    // they will be lost. So we need to call uploadQueuedHistoryEntries again
    // to upload any new entries.
    // If we made it here then the transaction succeed so we can remove the entriesToUpload
    // from the queue.
    this.completedHistoryEntryQueue.splice(0, entriesToUpload.length);
    this.uploadInProgress = false;

    // If there are more entries to upload, do that now
    if (this.completedHistoryEntryQueue.length > 0) {
      this.uploadQueuedHistoryEntries();
    }
  }

  // This is very similar to gotoHistoryEntry in TreeManager
  async applyHistoryEntries(entrySnapshots: HistoryEntrySnapshot[]) {
    const { treeManager } = this;
    const trees = Object.values(treeManager.trees);

    // Disable shared model syncing on all of the trees. This is
    // different than when the undo store applies patches because in
    // this case we are going to apply lots of history entries all at
    // once. We use FAKE ids here so any responses from tree are
    // not recorded in the history.
    const startPromises = trees.map(tree => {
      return tree.startApplyingPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID);
    });
    await Promise.all(startPromises);

    const treePatches: Record<string, IJsonPatch[] | undefined> = {};
    Object.keys(treeManager.trees).forEach(treeId => treePatches[treeId] = []);

    const entries: HistoryEntryType[] = entrySnapshots.map(snapshot => HistoryEntry.create(snapshot));

    for (const historyEntry of entries) {
      const records = historyEntry ? [ ...historyEntry.records] : [];
      for (const entryRecord of records) {
        const patches = treePatches[entryRecord.tree];
        patches?.push(...entryRecord.getPatches(HistoryOperation.Redo));
      }

      // Add this to the treeManager history so the local history is close the remote history
      // This should not cause the history entry to be sent back to firestore because that only
      // happens with onHistoryEntryCompleted which should only called for local edits.
      treeManager.addHistoryEntryAfterApplying(historyEntry);
    }

    const applyPromises = Object.entries(treePatches).map(([treeId, patches]) => {
      if (patches && patches.length > 0) {
        const tree = treeManager.trees[treeId];
        return tree?.applyPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID, patches);
      }
    });
    await Promise.all(applyPromises);

    // finish the patch application
    // Need to tell all of the tiles to re-enable the sync and run the sync
    // to resync their tile models with any changes applied to the shared models
    // For this final step, we still use promises so we can wait for everything to complete.
    // This can be used in the future to make sure multiple applyPatchesToTrees are not
    // running at the same time.
    const finishPromises = trees.map(tree => {
      return tree.finishApplyingPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID);
    });
    await Promise.all(finishPromises);
  }
}
