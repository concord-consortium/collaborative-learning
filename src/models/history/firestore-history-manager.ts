import { action, computed, makeObservable, observable, when } from "mobx";
import { addDisposer, getSnapshot, Instance, applySnapshot } from "mobx-state-tree";
import firebase from "firebase/app";
import { getSimpleDocumentPath } from "../../../shared/shared";
import { Firestore } from "../../lib/firestore";
import { UserContextProvider } from "../stores/user-context-provider";
import { getLastHistoryEntry, IFirestoreHistoryEntryDoc, loadHistory } from "./history-firestore";
import { CDocument, CDocumentType, TreeManagerType } from "./tree-manager";
import { HistoryEntry, HistoryEntrySnapshot } from "./history";

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
  historyError = undefined as firebase.firestore.FirestoreError | undefined;
  environmentAndMetadataDocReadyPromise: Promise<void> | undefined;
  firestoreHistoryInfoPromise: Promise<IFirestoreHistoryInfo> | undefined;

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
      this.subscribeToFirestoreHistory();
    }

    this.environmentAndMetadataDocReadyPromise = this.waitUntilEnvironmentAndMetadataDocReady();

    // We want computed properties like historyStatus to be observable
    makeObservable(this, {
      historyError: observable,
      setHistoryError: action,
      historyStatus: computed,
      historyStatusString: computed
    });
  }

  setHistoryError(error: any) {
    // We are reusing FirestoreError
    // TODO: why???
    this.historyError = {
        message: error instanceof Error ? error.message : String(error)
    } as firebase.firestore.FirestoreError;
  }

  get documentPath() {
    const { mainDocument } = this.treeManager;
    if (!mainDocument) {
      throw new Error("FirestoreHistoryManager.documentPath: no mainDocument");
    }
    return getSimpleDocumentPath(mainDocument.key);
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

  async waitUntilEnvironmentAndMetadataDocReady(): Promise<void> {
    const { userContextProvider, treeManager: { mainDocument }, firestore } = this;

    // The userContext initially starts out with a user id of 0 and doesn't have a portal and other
    // properties defined. After the user is authenticated the userContext will have valid fields.
    // This won't be a problem in most cases but for the initially displayed document it's
    // FirestoreHistoryManager might get created before the userContext is ready.
    const userContext = userContextProvider?.userContext;
    try {
      await when(() => !!userContext?.uid, { timeout: 5000 });
    } catch (error) {
      // Log the timeout while still allowing the environment checks below to handle the invalid state.
      console.warn(
        "Timed out waiting for user authentication (userContext.uid). " +
        "Proceeding to environment validation.",
        error
      );
    }

    try {
      if (!userContextProvider || !mainDocument || !firestore || !userContext?.uid) {
        console.error("cannot record history entry because environment is not valid",
          { userContext, mainDocument, firestore });
        throw new Error("cannot record history entry because environment is not valid");
      }

      // Get the path to the Firestore metadata document that will be the parent of the history entries
      const documentPath = getSimpleDocumentPath(mainDocument.key);
      await this.waitForMetadataDocument(documentPath);
    } catch (error) {
      // save this error so the historyStatus returns HISTORY_ERROR
      this.setHistoryError(error);
      throw error;
    }
  }

  async getFirestoreHistoryInfo() : Promise<IFirestoreHistoryInfo> {
    if (!this.firestoreHistoryInfoPromise) {
      this.firestoreHistoryInfoPromise = (async () => {
        await this.environmentAndMetadataDocReadyPromise;
        const { firestore, documentPath } = this;
        const lastHistoryEntry = await getLastHistoryEntry(firestore, documentPath);

        return {
          documentPath,
          // We start with -1 so if there is no last entry the next entry will get an index of 0
          // 0 is a valid index so ?? must be used instead of ||
          lastEntryIndex: lastHistoryEntry?.index ?? -1,
          // We use null here so this is a valid Firestore property value
          lastEntryId: lastHistoryEntry?.id || null
        };
      })();
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
    if (this.historyError) {
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
      }

      if (historyLength >= numHistoryEventsApplied) {
        return HistoryStatus.HISTORY_LOADED;
      }

      // In this case, the numHistoryEventsApplied tells us that we have more history
      // entries, but they haven't been loaded yet for some reason.
      // This might be an error, but more likely the history is still loading.
      return HistoryStatus.HISTORY_LOADING;
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

  /**
   * This is called each time the remote history changes in Firestore
   */
  syncRemoteFirestoreHistory(historyDocs: IFirestoreHistoryEntryDoc[]) {
    const { treeManager } = this;

    const history: HistoryEntrySnapshot[] = historyDocs.map(doc => doc.entry);

    if (!treeManager.document) {
      const cDocument = CDocument.create({history});
      treeManager.setChangeDocument(cDocument);
    } else {
      applySnapshot(treeManager.document, {history});
    }
  }

  async subscribeToFirestoreHistory() {
    const { treeManager, firestore } = this;
    const { mainDocument } = treeManager;

    const documentKey = mainDocument?.key;
    const userId = mainDocument?.uid;
    if (!documentKey || !userId) {
      console.warn("subscribeToFirestoreHistory, requires a mainDocument");
      return;
    }

    // Wait for the parent document to exist
    try {
      await this.environmentAndMetadataDocReadyPromise;
    } catch (error) {
      // The environment isn't correct or the metadata document doesn't exist
      // the error will set as this.historyError
      return;
    }
    const { documentPath } = this;

    // TODO: we should move this function into the history manager
    treeManager.setNumHistoryEntriesAppliedFromFirestore(firestore, documentPath);

    const snapshotUnsubscribe = loadHistory(firestore, `${documentPath}/history`,
      (history, error) => {
        if (error) {
          this.setHistoryError(error);
        } else {
          // FIXME: this is being called twice for a single change in the document.
          // I've confirmed there are not multiple listeners being created.
          // TODO: confirm this comment
          this.syncRemoteFirestoreHistory(history);
        }
      }
    );
    // Add this disposer so our Firestore listener is removed when the treeManager is destroyed
    addDisposer(treeManager, snapshotUnsubscribe);
  }
}
