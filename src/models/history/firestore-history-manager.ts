import { addDisposer, getSnapshot, Instance } from "mobx-state-tree";
import firebase from "firebase/app";
import { getSimpleDocumentPath, IDocumentMetadata } from "../../../shared/shared";
import { Firestore } from "../../lib/firestore";
import { typeConverter } from "../../utilities/db-utils";
import { UserContextProvider } from "../stores/user-context-provider";
import { getLastHistoryEntry, loadHistory } from "./history-firestore";
import { CDocument, CDocumentType, TreeManagerType } from "./tree-manager";
import { HistoryEntry } from "./history";
import { TreeAPI } from "./tree-api";
import { makeAutoObservable, when } from "mobx";

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

    if (uploadLocalHistory) {
      this.onHistoryEntryCompleted = this.onHistoryEntryCompleted.bind(this);
      treeManager.addHistoryEntryCompletedListener(this.onHistoryEntryCompleted);
    }

    if (syncRemoteHistory) {
      this.mirrorHistoryFromFirestore();
    }

    // We want computed properties like historyStatus to be observable
    makeAutoObservable(this);
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
          const cDocument = CDocument.create({history});
          treeManager.setChangeDocument(cDocument);
        }
      }
    );
    // Add this disposer so our Firestore listener is removed when the treeManager is destroyed
    addDisposer(treeManager, snapshotUnsubscribe);
  }
}

export class FirestoreHistoryManagerConcurrent extends FirestoreHistoryManager {

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
    // just reads and ans writes.
    //
    // TODO: If multiple entries are piled up because the firestore document isn't available yet,
    // this code here might not run in correct order. These multiple calls would all be waiting
    // on the firestoreInfoPromise above. Once that resolves the first one will start running
    // however it will then stop running again while waiting fro the read in the transaction.
    // That will then let the second onHistoryEntryCompleted call to start running again.
    // I don't think there is a guarantee which of the blocked read calls will resolve first.
    // So the second onHistoryEntryCompleted might go first, which will then give it a wrong
    // index and previous entry id.
    // To fix this we probably need to a queue so they always get processed in order. We could
    // batch them up in a single transaction so that we don't need to read the me doc for each
    // doc in the queue. But there is a limit to how many writes can be done in a single
    // transaction.
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

      const previousEntry = metadata.lastHistoryEntry;
      const previousEntryIndex = previousEntry?.index ?? -1;
      const previousEntryId = previousEntry?.id ?? null;

      // TODO: if we want to migrate existing documents to this approach then if there is no lastHistoryEntry
      // we need to look through the existing history entries. We can't do that in a transaction
      // though. So we would need to do that before starting the transaction.
      // This migration would not be safe if there are multiple clients writing history at the same time.
      // The plan is to just use this for new group documents, so if there is some lost history
      // for existing group documents that is OK.

      const newEntryIndex = previousEntryIndex + 1;
      transaction.update(firestore.documentRef(metadataPath), {
        lastHistoryEntry: {
          index: newEntryIndex,
          id: entry.id
        }
      });

      const docRef = firestore.documentRef(historyEntriesPath, entry.id);
      const snapshot = getSnapshot(entry);

      transaction.set(docRef, {
        index: newEntryIndex,
        created: firestore.timestamp(),
        previousEntryId,
        entry: JSON.stringify(snapshot)
      });
    });
  }
}
