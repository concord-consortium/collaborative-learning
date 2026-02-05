import { action, makeObservable, observable, runInAction } from "mobx";
import { getSnapshot, Instance, IJsonPatch } from "mobx-state-tree";
import { IDocumentMetadata } from "../../../shared/shared";
import { typeConverter } from "../../utilities/db-utils";
import { getLastHistoryEntry, IFirestoreHistoryEntryDoc, LastHistoryEntry } from "./history-firestore";
import { CDocumentType, FAKE_EXCHANGE_ID, FAKE_HISTORY_ENTRY_ID } from "./tree-manager";
import { HistoryEntry, HistoryEntrySnapshot, HistoryEntryType, HistoryOperation } from "./history";
import { FirestoreHistoryManager, IFirestoreHistoryManagerArgs } from "./firestore-history-manager";

export class FirestoreHistoryManagerConcurrent extends FirestoreHistoryManager {

  completedHistoryEntryQueue: Array<HistoryEntryType> = [];
  uploadInProgress = false;
  /**
   * Stop uploading history entries from Firestore temporarily.
   */
  paused = false;

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

    // Make paused observable so UI can react to changes
    makeObservable(this, {
      paused: observable,
      pauseUploads: action,
      resumeUploadsAfterDelay: action,
    });
  }

  async getInitialLastHistoryEntry() {
    if (!this.initialLastHistoryPromise) {
      await this.environmentAndMetadataDocReadyPromise;
      const { firestore, documentPath } = this;
      this.initialLastHistoryPromise = getLastHistoryEntry(firestore, documentPath);
    }
    return this.initialLastHistoryPromise;
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

    const existingHistory = treeManager.document.history;

    // We do not use applySnapshot here because it would replace the entire history with
    // the remote history. Sometimes there will be local history entries that have not
    // yet been uploaded, so we can't just overwrite those.
    // Instead we just add the new history entries that aren't in our local history yet.
    // This means that the history entries on this client will be in a different order
    // than on other clients. That's because those other clients wouldn't have our local
    // entries yet.
    // This problem is being punted for now.

    // Not the most efficient but lets get the history entries from the historyEntryDocs
    // If we unify on loadFirestoreHistory we can have it do this parsing for us
    const incomingHistory: HistoryEntrySnapshot[] = historyEntryDocs.map(doc => doc.entry);

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

    // The parent Firestore metadata document might not be ready yet so we need to wait for that.
    // FIXME: we need to handle the case where this errors out
    await this.environmentAndMetadataDocReadyPromise;
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

    // This should be the last entry that was applied to the document when it was first loaded.
    const lastEntry = await this.getInitialLastHistoryEntry();

    // Skip any entries that are before or equal to lastEntry
    // This approach not safe because lastEntry might be outdated. See the FIXME in the
    // constructor on getInitialLastHistoryEntry
    if (lastEntry) {
      const lastEntryIndex = entrySnapshots.findIndex(snapshot => snapshot.id === lastEntry.id);
      entrySnapshots = entrySnapshots.slice(lastEntryIndex + 1);
    }

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
