import { action, computed, makeObservable, observable, runInAction, when } from "mobx";
import { addDisposer, getSnapshot, Instance, applySnapshot, isAlive } from "mobx-state-tree";
import firebase from "firebase/app";
import { getSimpleDocumentPath } from "../../../shared/shared";
import { Firestore } from "../../lib/firestore";
import { UserContextProvider } from "../stores/user-context-provider";
import { LogEventName } from "../../lib/logger-types";
import {
  getHistoryEntriesAfter, getLastHistoryEntry, IFirestoreHistoryEntryDoc, loadHistory
} from "./history-firestore";
import { CDocument, CDocumentType, TreeManagerLogger, TreeManagerType } from "./tree-manager";
import { HistoryEntry, HistoryEntrySnapshot, HistoryEntryType } from "./history";
import { planCatchUp, takeContiguousEntries } from "./load-catch-up";
import { ICommitListener, ICommitSource, ICommittedEntry, VoidReason } from "./history-commits";
import { kHistoryStart, NotExactReason } from "./session-exactness";
import type { ISavedEnvelope } from "../document/document";

// The user id before the user is known.
const kUnknownUserId = "0";

const seekIncompleteMessage = (historyId: string) =>
  `Could not show this document at the requested point in its history (id: ${historyId}): ` +
  "some of its history could not be replayed.";

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
  // The history has loaded, and the content is being moved forward from the entry it holds to the
  // newest one (see contentEntryId).
  HISTORY_CATCHING_UP,
}

export interface IFirestoreHistoryManagerArgs {
  firestore: Firestore;
  userContextProvider: UserContextProvider;
  treeManager: TreeManagerType;
  uploadLocalHistory: boolean;
  syncRemoteHistory: boolean;
  // History fields recorded alongside the document content at save time (from the RTDB
  // envelope). When the envelope has exactThrough, catchUpAtLoad applies the entries after its
  // lastHistoryEntryId. When the Firestore history first loads, we verify its lastHistoryEntryId
  // is present in the history. If not, the content reflects entries that never made it to the
  // history chain — drift. Undefined skips the check.
  loadedEnvelope?: ISavedEnvelope;
  // Invoked once if the loaded Firestore history doesn't contain the loaded envelope's
  // lastHistoryEntryId. The owner decides how to react — typically by
  // setting the document content into an error state. Keeping this as a
  // callback avoids the history layer having to import DocumentModel.
  onContentDrift?: (message: string) => void;
  // Invoked once for each local entry after Firestore has accepted its upload. Not invoked for an entry
  // whose upload fails or that is rolled back before it is uploaded.
  onLocalEntryUploaded?: (entry: HistoryEntryType) => void;
  // Logs an event about the document, such as a load catch-up that couldn't finish.
  logEvent?: TreeManagerLogger;
  // For playback: the last history entry the content holds, when that can be older than the newest
  // entry in Firestore. Once the history loads, the content is moved forward from there to the
  // newest entry. Undefined means the content holds every entry.
  contentEntryId?: string;
}

/**
 * Manages saving history entries to Firestore for a document. In the future this class may
 * also manage loading history entries from Firestore.
 *
 * In the future there might be a subclass which handles documents being edited by multiple
 * users at the same time.
 */
export class FirestoreHistoryManager implements ICommitSource {
  firestore: Firestore;
  userContextProvider: UserContextProvider;
  treeManager: TreeManagerType;
  uploadLocalHistory: boolean;
  syncRemoteHistory: boolean;
  historyError = undefined as firebase.firestore.FirestoreError | undefined;
  environmentAndMetadataDocReadyPromise: Promise<void> | undefined;
  firestoreHistoryInfoPromise: Promise<IFirestoreHistoryInfo> | undefined;
  loadedEnvelope: ISavedEnvelope | undefined;
  onContentDrift: ((message: string) => void) | undefined;
  onLocalEntryUploaded: ((entry: HistoryEntryType) => void) | undefined;
  logEvent: TreeManagerLogger | undefined;
  driftChecked = false;
  // Why a requested history entry could not be shown, for the playback UI to
  // display. Undefined when no request has failed.
  historyEntryRequestError = undefined as string | undefined;
  // This session's newest committed local entry.
  lastCommitted: ICommittedEntry | undefined = undefined;
  // The last Firestore entry catchUpAtLoad applied to the loaded content, when it applied any.
  caughtUpTo: ICommittedEntry | undefined = undefined;
  // The envelope whose content catchUpAtLoad applied the entries through caughtUpTo to.
  caughtUpFrom: ISavedEnvelope | undefined = undefined;
  contentEntryId: string | undefined;
  // True until the content has been moved from contentEntryId to the newest entry.
  catchingUpToNewest: boolean;
  private commitListeners = new Set<ICommitListener>();
  // The local entries recorded for upload that haven't been reported committed, in chain order.
  private uncommitted: Array<ICommittedEntry & { uploaded: boolean }> = [];

  constructor({
    firestore,
    userContextProvider,
    treeManager,
    uploadLocalHistory,
    syncRemoteHistory,
    loadedEnvelope,
    onContentDrift,
    onLocalEntryUploaded,
    logEvent,
    contentEntryId
  }: IFirestoreHistoryManagerArgs) {
    this.firestore = firestore;
    this.userContextProvider = userContextProvider;
    this.treeManager = treeManager;
    this.uploadLocalHistory = uploadLocalHistory;
    this.syncRemoteHistory = syncRemoteHistory;
    this.loadedEnvelope = loadedEnvelope;
    this.onContentDrift = onContentDrift;
    this.onLocalEntryUploaded = onLocalEntryUploaded;
    this.logEvent = logEvent;
    this.contentEntryId = contentEntryId;
    this.catchingUpToNewest = contentEntryId !== undefined;

    if (syncRemoteHistory) {
      this.subscribeToFirestoreHistory();
    }

    this.environmentAndMetadataDocReadyPromise = this.waitUntilEnvironmentAndMetadataDocReady();

    // We want computed properties like historyStatus to be observable
    makeObservable(this, {
      historyError: observable,
      setHistoryError: action,
      historyEntryRequestError: observable,
      lastCommitted: observable.ref,
      catchingUpToNewest: observable,
      setCatchingUpToNewest: action,
      setHistoryEntryRequestError: action,
      historyStatus: computed,
      historyStatusString: computed
    });
  }

  addCommitListener(listener: ICommitListener) {
    this.commitListeners.add(listener);
    return () => { this.commitListeners.delete(listener); };
  }

  protected notifyCommitted(entries: ICommittedEntry[]) {
    if (entries.length === 0) return;
    runInAction(() => { this.lastCommitted = entries[entries.length - 1]; });
    this.commitListeners.forEach(listener => listener.onCommitted(entries));
  }

  protected notifyVoided(reason: VoidReason) {
    this.commitListeners.forEach(listener => listener.onUncommittedVoided(reason));
  }

  setHistoryEntryRequestError(message: string | undefined) {
    this.historyEntryRequestError = message;
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

  /**
   * True when the current user is known and isn't the document's owner. Only the owner writes an
   * individual document's history and content, so another user's copy has nothing to catch up.
   */
  get isOtherUsersDocument() {
    const uid = this.userContextProvider?.userContext?.uid;
    const ownerUid = this.treeManager.mainDocument?.uid;
    return !!uid && uid !== kUnknownUserId && uid !== ownerUid;
  }

  /**
   * Bring an individual document's content up to the last history entry in Firestore, applying
   * the entries its envelope is missing, and decide where the session's exact saves start. The
   * envelope is the one the content came from, which is the loaded one unless the content has
   * been replaced since. Managers that mirror the remote history or don't upload local history skip
   * it, as does another user's copy of the document, leaving its exactness undecided.
   * Only an envelope with exactThrough is caught up. The id of one without it can be older than
   * what its content holds, so applying the entries after it could apply some of them twice.
   * Never rejects: anything that keeps the catch-up from finishing leaves the session not exact.
   */
  async catchUpAtLoad(envelope = this.loadedEnvelope) {
    if (this.syncRemoteHistory || !this.uploadLocalHistory || this.isOtherUsersDocument) return;
    const { exactness } = this.treeManager;
    const savedId = envelope?.lastHistoryEntryId;
    // Where exact saves start once the content is known to match `contentId`.
    const startAt = (contentId: string) => {
      exactness.startAt(envelope?.exactThrough?.since ?? contentId);
    };
    const incomplete = (reason: NotExactReason, params: Record<string, unknown> = {}) => {
      exactness.markNotExact(reason);
      this.logEvent?.(LogEventName.HISTORY_LOAD_CATCH_UP_INCOMPLETE, { reason, savedId, ...params });
    };

    let applying = false;
    try {
      // The user may only become known during this wait.
      await this.environmentAndMetadataDocReadyPromise;
      if (this.isOtherUsersDocument) return;
      const { documentPath, lastEntryIndex, lastEntryId } = await this.getFirestoreHistoryInfo();
      const last = { id: lastEntryId, index: lastEntryIndex };
      const saved = { id: savedId, index: envelope?.exactThrough?.index };
      const plan = planCatchUp(saved, last);
      switch (plan.kind) {
        case "none":
          // With nothing to fetch, a saved id other than the last entry can't be in Firestore: an
          // entry in Firestore with an index at or after the last entry's would be the last entry.
          if (savedId && savedId !== lastEntryId) {
            exactness.markNotExact("saved-id-missing");
          } else {
            startAt(savedId ?? lastEntryId ?? kHistoryStart);
          }
          return;
        case "unmarked":
          incomplete("unmarked-envelope-gap");
          return;
        case "too-large":
          incomplete("catch-up-gap-too-large", { gap: plan.gap });
          return;
        case "fetch": {
          const gap = lastEntryIndex - plan.afterIndex;
          // Stops at the last entry read, since that is the entry the next local entry chains after.
          const docs = await getHistoryEntriesAfter(this.firestore, documentPath, plan.afterIndex, lastEntryIndex);
          const { entries } = takeContiguousEntries(docs, savedId!, plan.afterIndex);
          applying = true;
          const { applied, error } = await this.treeManager.applyEntriesAtLoad(entries.map(doc => doc.entry));
          const lastApplied = entries[applied - 1];
          if (lastApplied) {
            this.caughtUpTo = { id: lastApplied.id, index: lastApplied.index };
            this.caughtUpFrom = envelope;
          }
          if (error !== undefined) {
            incomplete("catch-up-apply-failed", { gap, applied, error });
          } else if (entries[entries.length - 1]?.id !== lastEntryId) {
            incomplete("catch-up-hole", { gap, applied });
          } else {
            startAt(lastEntryId);
          }
          break;
        }
      }
    } catch (error) {
      if (applying) {
        incomplete("catch-up-apply-failed", { error: error instanceof Error ? error.message : String(error) });
      } else {
        exactness.markNotExact("history-unavailable");
      }
    }
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
    const recorded = { id: entry.id, index, uploaded: false };
    this.uncommitted.push(recorded);
    try {
      await docRef.set({
        index,
        created: firestore.timestamp(),
        previousEntryId,
        entry: JSON.stringify(snapshot)
      });
    } catch (error) {
      // The entry stays unuploaded, so it and every later entry stay uncommitted.
      console.warn("Could not upload history entry", entry.id, error);
      return;
    }
    recorded.uploaded = true;
    this.onLocalEntryUploaded?.(entry);
    this.commitUploadedPrefix();
  }

  // An entry is committed once it and every earlier entry from this session have uploaded.
  private commitUploadedPrefix() {
    const count = this.uncommitted.findIndex(recorded => !recorded.uploaded);
    const committed = this.uncommitted.splice(0, count < 0 ? this.uncommitted.length : count);
    this.notifyCommitted(committed.map(({ id, index }) => ({ id, index })));
  }

  get historyStatus() : HistoryStatus {
    const status = this.getLoadStatus();
    return status === HistoryStatus.HISTORY_LOADED && this.catchingUpToNewest
      ? HistoryStatus.HISTORY_CATCHING_UP
      : status;
  }

  setCatchingUpToNewest(value: boolean) {
    this.catchingUpToNewest = value;
  }

  // The status of loading the history, leaving out the move to the newest entry.
  private getLoadStatus() : HistoryStatus {
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
      case HistoryStatus.HISTORY_CATCHING_UP:
        return "Loading the latest changes.";
      default:
        return "Unknown history status";
    }
  }

  async moveToHistoryEntryAfterLoad(historyId: string) {
    // Any message on screen describes a request this one replaces, and the wait below can take
    // 30 seconds, so drop it before starting rather than when this request resolves.
    this.setHistoryEntryRequestError(undefined);

    // NO_HISTORY is the INITIAL status, not a terminal one — a freshly constructed manager reports it
    // before the Firestore query has run. So we must wait for the history to actually load (or error),
    // not stop on NO_HISTORY, or we'd give up before the entries arrive and never seek. A bounded
    // timeout avoids leaking the reaction if the load never completes (e.g. a genuinely empty document,
    // which stays NO_HISTORY forever).
    const historyNotLoadedMessage =
      "Could not load this document's history, so it could not be shown at the requested point.";
    try {
      await when(
        () => this.historyStatus === HistoryStatus.HISTORY_LOADED ||
              this.historyStatus === HistoryStatus.HISTORY_ERROR,
        { timeout: 30000 }
      );
    } catch {
      console.warn("moveToHistoryEntryAfterLoad: history did not load within timeout; status:",
        this.historyStatus);
      this.setHistoryEntryRequestError(historyNotLoadedMessage);
      return;
    }
    if (this.historyStatus !== HistoryStatus.HISTORY_LOADED) {
      console.warn("moveToHistoryEntryAfterLoad: history did not load; status:", this.historyStatus);
      this.setHistoryEntryRequestError(historyNotLoadedMessage);
      return;
    }
    // goToHistoryEntryPosition takes a position, which counts applied entries: position p is the
    // document with entries 0..p-1 applied. A historyId names the entry the document had reached,
    // so the moment it names is the position that includes it, one past its index.
    // "first" is the sentinel logDocumentEvent emits for a change made before the document had
    // any entry at all, which is position 0.
    let position = 0;
    if (historyId !== "first") {
      const index = this.treeManager.findHistoryEntryIndex(historyId);
      if (index < 0) {
        console.warn("Did not find history entry with id: ", historyId);
        this.setHistoryEntryRequestError(
          `Could not find the requested point in this document's history (id: ${historyId}).`);
        return;
      }
      position = index + 1;
    }

    // goToHistoryEntryPosition stops at the last position it could apply, so where it landed
    // has to be checked.
    try {
      await this.treeManager.goToHistoryEntryPosition(position);
    } catch (error) {
      console.warn("moveToHistoryEntryAfterLoad: seek failed for id:", historyId, error);
      this.setHistoryEntryRequestError(seekIncompleteMessage(historyId));
      return;
    }
    // Nothing to report on success: the message was cleared before the request started.
    if (this.treeManager.numHistoryEventsApplied !== position) {
      console.warn("moveToHistoryEntryAfterLoad: seek stopped at",
        this.treeManager.numHistoryEventsApplied, "instead of", position, "for id:", historyId);
      this.setHistoryEntryRequestError(seekIncompleteMessage(historyId));
    }
  }

  /**
   * Once the history has loaded, moves the content from the entry it holds to the newest entry,
   * so playback opens with content that holds every entry it shows. A move that stops on an entry
   * that doesn't apply leaves playback there, with the failure marked. Content whose entry isn't in
   * the history is left at the newest entry, as content is when its entry isn't known.
   */
  private async moveContentToNewestEntry(contentEntryId: string) {
    const { treeManager } = this;
    try {
      // Bounded, like moveToHistoryEntryAfterLoad, so a history that never loads doesn't leak the
      // reaction.
      await when(() => {
        const status = this.getLoadStatus();
        return status === HistoryStatus.HISTORY_LOADED || status === HistoryStatus.HISTORY_ERROR;
      }, { timeout: 30000 });
      if (this.historyError || !isAlive(treeManager)) return;
      const newest = treeManager.document.history.length;
      const contentPosition = treeManager.findHistoryEntryIndex(contentEntryId) + 1;
      if (contentPosition > 0 && contentPosition < newest) {
        treeManager.setNumHistoryEntriesApplied(contentPosition);
        await treeManager.goToHistoryEntryPosition(newest);
      }
    } catch (error) {
      console.warn("Could not move the playback content to the newest history entry:", error);
    } finally {
      this.setCatchingUpToNewest(false);
    }
  }

  /**
   * Compare the envelope's saved lastHistoryEntryId against the loaded
   * Firestore history. If the saved id isn't found in the history, the
   * loaded content reflects edits that never made it to the history chain —
   * drift. On mismatch, invoke onContentDrift so the owner can surface
   * the DocumentError UI instead of leaving potentially-corrupted content
   * visible to the user.
   *
   * Skipped when no saved id is available (pre-feature envelopes, fresh
   * documents with no prior history).
   *
   * This only runs when subscribeToFirestoreHistory is actually invoked,
   * which today is gated by syncRemoteHistory=true in the manager args.
   * In practice that means group documents (see documents.ts) and the
   * playback path (see canvas.tsx). Playback doesn't pass
   * a loaded envelope so the check is a no-op there. Other document
   * types never subscribe, so the drift check does not run for them.
   */
  checkContentDriftAgainstHistory(history: IFirestoreHistoryEntryDoc[]) {
    const savedId = this.loadedEnvelope?.lastHistoryEntryId;
    if (!savedId) return;
    const found = history.some(doc => doc.entry?.id === savedId);
    if (found) return;

    const tailId = history.length > 0 ? history[history.length - 1].entry?.id : undefined;
    const message =
      `History drift detected: content was saved with lastHistoryEntryId="${savedId}" ` +
      `but that id is not present in the Firestore history ` +
      `(history length=${history.length}, tail id=${tailId ?? "none"}). ` +
      `The content may reflect edits that never made it to the history chain.`;
    console.error("CLUE history drift:", message);

    this.onContentDrift?.(message);
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
    if (this.contentEntryId !== undefined) {
      void this.moveContentToNewestEntry(this.contentEntryId);
    }

    const snapshotUnsubscribe = loadHistory(firestore, `${documentPath}/history`,
      (history, error) => {
        if (error) {
          this.setHistoryError(error);
        } else {
          // Run the drift check once, on the first successful load. Subsequent
          // snapshots are delta updates and don't represent the "as loaded"
          // state the content was saved against.
          if (!this.driftChecked) {
            this.driftChecked = true;
            this.checkContentDriftAgainstHistory(history);
          }
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
