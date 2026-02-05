import { getSnapshot, Instance } from "mobx-state-tree";
import { IDocumentMetadata } from "../../../shared/shared";
import { typeConverter } from "../../utilities/db-utils";
import { CDocumentType } from "./tree-manager";
import { HistoryEntry } from "./history";
import { FirestoreHistoryManager, IFirestoreHistoryManagerArgs } from "./firestore-history-manager";

/**
 * A concurrent version of FirestoreHistoryManager that uses Firestore transactions
 * to safely handle multiple users editing the same document simultaneously.
 *
 * Unlike the base class which assumes sequential editing, this class reads the
 * current last entry from Firestore metadata on each write to ensure consistent
 * indexing even with concurrent edits.
 */
export class FirestoreHistoryManagerConcurrent extends FirestoreHistoryManager {

  constructor(args: IFirestoreHistoryManagerArgs) {
    super(args);
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
    await this.environmentAndMetadataDocReadyPromise;
    const { firestore, documentPath } = this;

    // add a new document for this history entry
    const metadataPath = firestore.getFullPath(documentPath);
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
    // TODO: If multiple entries are piled up because the firestore document isn't available yet,
    // this code here might not run in correct order. These multiple calls would all be waiting
    // on the firestoreInfoPromise above. Once that resolves the first one will start running
    // however it will then stop running again while waiting for the read in the transaction.
    // That will then let the second onHistoryEntryCompleted call to start running again.
    // I don't think there is a guarantee which of the blocked read calls will resolve first.
    // So the second onHistoryEntryCompleted might go first, which will then give it a wrong
    // index and previous entry id.
    // To fix this we probably need to add a queue so they always get processed in order. We could
    // batch them up in a single transaction so that we don't need to read the metadata doc for each
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
