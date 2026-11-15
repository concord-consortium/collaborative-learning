import type { DocumentModelType } from "../document/document";
import { FirestoreHistoryManager } from "./firestore-history-manager";
import { TreeManagerType } from "./tree-manager";

/**
 * Returns the last Firestore history entry a document's content holds, for playback to start from.
 * An individual document's content can be behind its history: another user's copy is never caught
 * up, and neither is the owner's until it is opened for editing.
 *
 * Returns undefined when the content holds every entry this client knows of, or when its entry
 * can't be known: for a concurrent document, which follows its history live, for a document this
 * session has recorded entries in, and for content from an envelope without exactThrough.
 */
export function getContentHistoryEntryId(document: DocumentModelType): string | undefined {
  if (document.concurrent) return undefined;
  const treeManager = document.treeManagerAPI as TreeManagerType | undefined;
  if (!treeManager || treeManager.document.history.length > 0) return undefined;
  const envelope = document.savedEnvelope;
  // The content listener can replace the content the catch-up applied entries to.
  const manager = treeManager.historyManager;
  if (manager instanceof FirestoreHistoryManager && manager.caughtUpTo && manager.caughtUpFrom === envelope) {
    return manager.caughtUpTo.id;
  }
  return envelope?.exactThrough ? envelope.lastHistoryEntryId : undefined;
}
