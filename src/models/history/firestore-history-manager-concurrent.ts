import { action, makeObservable, observable, runInAction } from "mobx";
import { getSnapshot, Instance, IJsonPatch } from "mobx-state-tree";
import { IDocumentMetadata } from "../../../shared/shared";
import { typeConverter } from "../../utilities/db-utils";
import { getLastHistoryEntry, IFirestoreHistoryEntryDoc, LastHistoryEntry } from "./history-firestore";
import { CDocumentType, FAKE_EXCHANGE_ID, FAKE_HISTORY_ENTRY_ID } from "./tree-manager";
import { HistoryEntry, HistoryEntrySnapshot, HistoryEntryType, HistoryOperation } from "./history";
import { FirestoreHistoryManager, IFirestoreHistoryManagerArgs } from "./firestore-history-manager";
import { partitionLocalEntriesForMerge } from "./entry-scopes";
import { buildRevertEntrySnapshot } from "./revert-entry";

/**
 * Thrown inside the upload transaction when the remote chain's head
 * has advanced past what we expected — meaning another client has
 * committed entries we don't yet know about. Aborts the transaction
 * so the pending uploads don't chain off a stale head. The receive
 * side will pick up the unknown remote entries via the Firestore
 * listener and trigger the shared rollback path.
 */
export class RemoteHeadChangedError extends Error {
  constructor(public expected: string | null, public actual: string | null) {
    super(`Remote head changed: expected ${expected}, actual ${actual}`);
    this.name = "RemoteHeadChangedError";
  }
}

export class FirestoreHistoryManagerConcurrent extends FirestoreHistoryManager {

  completedHistoryEntryQueue: Array<HistoryEntryType> = [];
  uploadInProgress = false;
  /**
   * The id of the entry we believe is currently the last entry on the
   * remote chain. `null` means "no remote entries yet." Used on the
   * send side for fork detection: if metadata.lastHistoryEntry.id
   * differs from this during the upload transaction, someone else
   * committed entries we don't know about; we abort the upload.
   * Receive-side fork detection uses the upload queue (see
   * `detectAndResolveFork`); this value is advanced after each
   * successful apply but not consulted there.
   * Updated after successful remote application and after successful
   * upload.
   */
  expectedRemoteHead: string | null = null;

  /**
   * Stop uploading history entries from Firestore temporarily.
   */
  paused = false;

  /**
   * Seconds remaining on the active resume-after-delay countdown, or
   * null when no resume is pending. Drives the history-view button's
   * "Resuming in Ns…" feedback while paused waits for the timer to fire.
   */
  resumeCountdownSeconds: number | null = null;

  /**
   * Stop processing remote history entries delivered by the Firestore
   * listener. Only used manually from the history-view panel to set up
   * fork scenarios deterministically — specifically, to drive the
   * send-side RemoteHeadChangedError path, which otherwise races the
   * listener. loadHistory delivers the full remote state on each
   * snapshot, so we simply buffer the latest delivery and replay it on
   * resume.
   */
  pausedDownloads = false;
  pendingDownloadBuffer: IFirestoreHistoryEntryDoc[] | undefined;

  /**
   * Serialization chain for applyHistoryEntries. Each call awaits the
   * previous promise before doing work so that concurrent listener
   * firings don't cause interleaved mutations of document.history and
   * the upload queue. Rejection-safe: the chain continues even after
   * a prior call throws.
   */
  applyInProgress: Promise<void> = Promise.resolve();

  initialLastHistoryPromise: Promise<LastHistoryEntry> | undefined;

  constructor(args: IFirestoreHistoryManagerArgs) {
    super(args);

    // Start loading the initial last history entry right away.
    // We use this last history entry to determine which history entries need to be applied
    // to the document when we first load the history. The initial document content is loaded
    // separately from the history entries. After this initial document content load, the
    // document content is not updated from the realtime database again. All updates come
    // from the history entries.
    // So we want to try to get the last history entry that was applied to the document
    // that we initially load.
    // FIXME: this approach is error prone because:
    // - a new history entry might be added after our initial fetch the document content
    //   before we get the last history entry here.
    // - perhaps, a network delay might cause the initial fetch of the document to happen after this
    //   history entry fetch. I haven't verified this is actually possible.
    // The most robust approach is to include all applied history entry ids in the document content
    // that is written to Firebase Realtime Database. We can look at this list and only apply
    // history entries that are not in this list.
    this.getInitialLastHistoryEntry();

    // Make paused observable so UI can react to changes.
    // The <this, "setExpectedRemoteHead"> type parameter widens
    // AnnotationsMap to include the private setter, which otherwise
    // wouldn't be assignable. The method still needs to be wrapped as
    // an action so MobX batches its mutation.
    makeObservable<this, "setExpectedRemoteHead">(this, {
      paused: observable,
      pausedDownloads: observable,
      resumeCountdownSeconds: observable,
      expectedRemoteHead: observable,
      pauseUploads: action,
      resumeUploadsAfterDelay: action,
      pauseDownloads: action,
      resumeDownloads: action,
      setExpectedRemoteHead: action,
    });
  }

  async getInitialLastHistoryEntry() {
    if (!this.initialLastHistoryPromise) {
      await this.environmentAndMetadataDocReadyPromise;
      const { firestore, documentPath } = this;
      this.initialLastHistoryPromise = getLastHistoryEntry(firestore, documentPath).then(entry => {
        // Seed expectedRemoteHead from the initial load exactly once.
        // Later updates come from applyHistoryEntries / uploadQueuedHistoryEntries.
        // Calling setExpectedRemoteHead here is safe: the method is
        // registered as a MobX action via makeObservable, so it creates
        // its own action batch for the mutation even though the .then
        // callback itself is not an action context.
        this.setExpectedRemoteHead(entry?.id ?? null);
        return entry;
      });
    }
    return this.initialLastHistoryPromise;
  }

  pauseUploads() {
    this.paused = true;
  }

  resumeUploadsAfterDelay(delayMs: number) {
    // Ignore re-entry while a countdown is already running.
    if (this.resumeCountdownSeconds !== null) return;

    this.resumeCountdownSeconds = Math.max(1, Math.ceil(delayMs / 1000));

    const tick = () => {
      runInAction(() => {
        const remaining = (this.resumeCountdownSeconds ?? 0) - 1;
        if (remaining > 0) {
          this.resumeCountdownSeconds = remaining;
          setTimeout(tick, 1000);
        } else {
          this.resumeCountdownSeconds = null;
          this.paused = false;
          this.uploadQueuedHistoryEntries();
        }
      });
    };
    setTimeout(tick, 1000);
  }

  pauseDownloads() {
    this.pausedDownloads = true;
  }

  resumeDownloads() {
    this.pausedDownloads = false;
    const buffered = this.pendingDownloadBuffer;
    this.pendingDownloadBuffer = undefined;
    if (buffered) {
      this.applyHistoryEntries(buffered);
    }
  }

  private setExpectedRemoteHead(id: string | null) {
    this.expectedRemoteHead = id;
  }

  syncRemoteFirestoreHistory(historyEntryDocs: IFirestoreHistoryEntryDoc[]): void {
    const { treeManager } = this;

    if (!treeManager.document) {
      // If there is no change document yet it seems like it should be an error
      // We are only working on documents that are editable. So they should have
      // a change document created automatically. However perhaps it doesn't get
      // created until the first entry shows up?
      // For now just throw an error so we can figure out if this case happens.
      throw new Error("syncRemoteFirestoreHistory: no change document exists yet");
      // If we need to create the change document here, we can use this code:
      // treeManager.setChangeDocument(CDocument.create({history: []}));
    }

    if (this.pausedDownloads) {
      // Buffer the latest delivery; loadHistory sends the full remote
      // state on every snapshot, so later deliveries supersede earlier
      // ones. resumeDownloads replays the latest buffered state.
      this.pendingDownloadBuffer = historyEntryDocs;
      return;
    }

    // Pass the wrapper docs through so fork detection can see
    // previousEntryId on each entry. Entries are unwrapped to
    // HistoryEntrySnapshot inside doApplyHistoryEntries where they're
    // actually applied to the tree.
    //
    // We do not use applySnapshot here because it would replace the entire
    // history with the remote history, discarding any local entries that
    // haven't been uploaded yet. Instead doApplyHistoryEntries skips entries
    // already in local history, and — via detectAndResolveFork →
    // rollbackLocalEntries — rolls back local-uncommitted entries whose
    // scope conflicts with the incoming batch. Surviving local entries
    // stay in place; remote entries (and any revert entries from the
    // rollback) are appended in application order, which may diverge
    // from the eventual Firestore chain order.
    //
    // FIXME: applyHistoryEntries is fire-and-forget here. It can reject
    // (e.g., patch application or rollback failures) and those rejections
    // surface as unhandled promise errors — see the similar pattern note in
    // firestore-history-manager.ts around the metadata-doc timeout. We
    // should route failures into setHistoryError / logging so they're
    // handled deterministically. The same applies to the call in
    // resumeDownloads below.
    this.applyHistoryEntries(historyEntryDocs);
  }

  async onHistoryEntryCompleted(
    historyContainer: CDocumentType,
    entry: Instance<typeof HistoryEntry>,
    newLocalIndex: number
  ) {
    // Multiple entries can piled up, while some are being uploaded. A simple promise system
    // doesn't guarantee that the uploads will happen in the correct order. So a queue is used.
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
    let uploadAborted = false;

    try {
      // The parent Firestore metadata document might not be ready yet so we need to wait for that.
      // TODO: If this promise rejects, it will throw on every subsequent call since rejected promises
      // throw each time they're awaited. This creates an endless cycle of silent failures as new
      // history entries keep getting queued. We should:
      // 1. Track when this has failed and stop retrying
      // 2. Show the user that sync is broken
      await this.environmentAndMetadataDocReadyPromise;

      // Also wait for the initial last-history-entry fetch to seed
      // expectedRemoteHead. Without this, a local edit queued before the
      // seed resolves would hit the send-side fork check below with
      // expectedRemoteHead still at its default null, spuriously throwing
      // RemoteHeadChangedError for any document that already has remote
      // history. After the first seed completes, subsequent uploads take
      // the cached promise, so the extra await is effectively free.
      await this.getInitialLastHistoryEntry();

      const { firestore } = this;

      // add a new document for this history entry
      const metadataPath = firestore.getFullPath(this.documentPath);
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
      // Firestore has a limit of 500 operations per transaction, and 10 MiB for all transferred data.
      // To be safe we limit how many entries we upload in a single transaction.
      const MAX_ENTRIES_PER_TRANSACTION = 20;
      const entriesToUpload = this.completedHistoryEntryQueue.slice(0, MAX_ENTRIES_PER_TRANSACTION);
      if (entriesToUpload.length === 0) {
        // Nothing to do
        return;
      }
      try {
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

          // Send-side fork check: if metadata's last-entry id differs
          // from what we expect, another client has advanced the remote
          // chain. Abort the transaction so we don't chain our local
          // entries onto a stale head. The receive side will handle
          // the rollback when the listener delivers the unknown entries.
          if (lastEntryId !== this.expectedRemoteHead) {
            throw new RemoteHeadChangedError(this.expectedRemoteHead, lastEntryId);
          }

          // TODO: if we want to migrate existing documents to this approach then if there is no lastHistoryEntry
          // we need to look through the existing history entries. We can't do that in a transaction
          // though. So we would need to do that before starting the transaction.
          // This migration would not be safe if there are multiple clients writing history at the same time.
          // The plan is to just use this for new group documents, so if there is some lost history
          // for existing group documents that is OK.

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
      } catch (error) {
        if (error instanceof RemoteHeadChangedError) {
          // Expected: another client wrote between our read and this
          // transaction. Leave the queue intact; the receive side
          // will drain it after resolving the fork.
          uploadAborted = true;
        } else {
          throw error;
        }
      }

      if (!uploadAborted) {
        // Transaction succeeded: remove uploaded entries from the queue.
        this.completedHistoryEntryQueue.splice(0, entriesToUpload.length);

        // Advance expectedRemoteHead: our uploaded entries are now on the
        // remote chain, so our last-uploaded id is the new head.
        const lastUploaded = entriesToUpload[entriesToUpload.length - 1];
        if (lastUploaded) {
          this.setExpectedRemoteHead(lastUploaded.id);
        }
      }
    } finally {
      this.uploadInProgress = false;
    }

    // If there are more entries to upload, do that now.
    // But don't retry if we aborted due to a remote-head mismatch —
    // the receive-side listener will re-trigger uploads after the fork
    // is resolved.
    if (!uploadAborted && this.completedHistoryEntryQueue.length > 0) {
      this.uploadQueuedHistoryEntries();
    }
  }

  /**
   * Roll back the last `count` entries in the upload queue. Their
   * inverse patches are aggregated into a single tree-apply call to
   * mutate document state. Then one revert entry is appended to
   * `document.history` per original, in newest-first order, as a
   * record of the rollback — these revert entries are currently for
   * debugging only and are not themselves applied to the document.
   * The originals stay in history and are removed from the upload
   * queue and the undo store (their effects have been reverted, so
   * they are no longer user-undoable).
   *
   * Safe under the current scope-disjoint merge rule: the originals'
   * inverse patches do not touch paths modified by entries applied
   * after them (verified by the batch-1 scope check for remote entries
   * between original-apply and rollback).
   */
  async rollbackLocalEntries(count: number, triggeringBatchIds: string[]): Promise<void> {
    if (count <= 0) return;
    const { treeManager } = this;

    const queue = this.completedHistoryEntryQueue;
    const originals = queue.slice(queue.length - count);
    const originalIds = new Set(originals.map(e => e.id));

    // Newest-first for both the aggregate inverse-patch application
    // and the order of revert entries appended to history.
    const originalsNewestFirst = [...originals].reverse();

    const trees = Object.values(treeManager.trees);
    await Promise.all(trees.map(tree =>
      tree.startApplyingPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID)));

    const treePatches: Record<string, IJsonPatch[]> = {};
    Object.keys(treeManager.trees).forEach(treeId => { treePatches[treeId] = []; });
    for (const entry of originalsNewestFirst) {
      const records = [...entry.records].reverse();
      for (const record of records) {
        const patches = treePatches[record.tree];
        if (patches) patches.push(...record.getPatches(HistoryOperation.Undo));
      }
    }

    await Promise.all(Object.entries(treePatches).map(([treeId, patches]) => {
      if (patches.length === 0) return undefined;
      const tree = treeManager.trees[treeId];
      return tree?.applyPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID, patches);
    }));

    await Promise.all(trees.map(tree =>
      tree.finishApplyingPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID)));

    // Append one revert entry per original in newest-first order.
    for (const original of originalsNewestFirst) {
      const revertSnapshot = buildRevertEntrySnapshot(getSnapshot(original), triggeringBatchIds);
      const revertEntry = HistoryEntry.create(revertSnapshot);
      treeManager.addHistoryEntryAfterApplying(revertEntry);
    }

    // Remove originals from the upload queue and undo store. Originals
    // stay in document.history.
    this.completedHistoryEntryQueue = queue.filter(e => !originalIds.has(e.id));
    treeManager.undoStore.removeHistoryEntries(originalIds);
  }

  /**
   * Decide whether any pending local entries conflict with an incoming
   * batch of remote entries. Local-uncommitted means "in the upload
   * queue," not "after expectedRemoteHead in history" — after a partial
   * fork resolution, remote entries can be interleaved with pending
   * locals in application order, so the queue is the reliable source.
   *
   * If the queue is empty there is nothing to check. Otherwise run
   * `partitionLocalEntriesForMerge` against the queue; if any local
   * entry conflicts, rollback from that entry onward and record the
   * rollback with the incoming batch's ids.
   */
  async detectAndResolveFork(newEntrySnapshots: HistoryEntrySnapshot[]): Promise<void> {
    if (newEntrySnapshots.length === 0) return;
    if (this.completedHistoryEntryQueue.length === 0) return;

    const localSnapshots = this.completedHistoryEntryQueue.map(e => getSnapshot(e));
    const incomingIds = newEntrySnapshots.map(e => e.id);

    const { rollbackCount } =
      partitionLocalEntriesForMerge(localSnapshots, newEntrySnapshots);

    if (rollbackCount > 0) {
      await this.rollbackLocalEntries(rollbackCount, incomingIds);
    }
  }

  /**
   * Public entry point. Serializes concurrent callers by chaining
   * through applyInProgress. Each call waits for the previous to
   * finish (even if the previous rejected) before doing work.
   */
  async applyHistoryEntries(wrapperDocs: IFirestoreHistoryEntryDoc[]): Promise<void> {
    const previous = this.applyInProgress;
    const run = (async () => {
      try { await previous; } catch { /* prior call failed — still run */ }
      return this.doApplyHistoryEntries(wrapperDocs);
    })();
    // Record a rejection-safe handle so future callers don't inherit
    // a rejected promise (which would then re-throw on every await).
    this.applyInProgress = run.then(() => undefined, () => undefined);
    return run;
  }

  // The second half of this method is very similar to gotoHistoryEntry in TreeManager
  private async doApplyHistoryEntries(wrapperDocs: IFirestoreHistoryEntryDoc[]) {
    const { treeManager } = this;

    // The wrappers' index/previousEntryId aren't consulted on the receive
    // side; only the entry snapshots are needed from here on.
    const incomingHistory: HistoryEntrySnapshot[] = wrapperDocs.map(doc => doc.entry);

    // This should be the last entry that was applied to the document when it was first loaded.
    const lastEntry = await this.getInitialLastHistoryEntry();

    // Skip any entries that are before or equal to lastEntry
    // This approach not safe because lastEntry might be outdated. See the FIXME in the
    // constructor on getInitialLastHistoryEntry
    let unappliedHistory = incomingHistory;
    if (lastEntry) {
      const lastEntryIndex = incomingHistory.findIndex(snapshot => snapshot.id === lastEntry.id);

      // TODO: we might want to add the already applied history entries to the local treeManager
      // history of the document. This would be so the local history matches the remote history.
      // However everything works without doing this. Also not applying them makes the
      // history viewer less cluttered with previous entries. So for now we just skip doing this.
      // Something like:
      //   treeManager.addHistoryEntryAfterApplying(incomingHistory.slice(0, lastEntryIndex + 1))

      // Update the list that will be used below to only include entries after lastEntry
      unappliedHistory = incomingHistory.slice(lastEntryIndex + 1);
    }

    const existingHistory = treeManager.document.history;

    // Skip any entries that are already in our local history
    // TODO: this could be more efficient by combining it with the incomingHistory.findIndex()
    // above.
    const existingIds = new Set(existingHistory.map(e => e.id));
    const entrySnapshots: HistoryEntrySnapshot[] = unappliedHistory
      .filter(entry => !existingIds.has(entry.id));

    // Fork detection: if any pending local entry's scope conflicts with
    // the incoming batch, roll back from that entry onward and append
    // revert entries.
    await this.detectAndResolveFork(entrySnapshots);

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

    // Advance expectedRemoteHead to the id of the last incoming entry.
    // These came from the remote listener, so they're on the remote chain
    // even if local history already contains some of them. If no entries
    // were delivered, leave the head alone.
    const lastIncoming = incomingHistory[incomingHistory.length - 1];
    if (lastIncoming) {
      this.setExpectedRemoteHead(lastIncoming.id);
    }

    // Surviving uncommitted entries (none rolled back, or only some
    // rolled back) need to chain off the new head as their
    // previousEntryId. When all locals were rolled back, the queue is
    // empty and this is a no-op.
    if (this.completedHistoryEntryQueue.length > 0) {
      this.uploadQueuedHistoryEntries();
    }
  }
}
