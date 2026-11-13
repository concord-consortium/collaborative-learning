import { INotExactEvidence } from "../../lib/db-types";
import { FAKE_HISTORY_ENTRY_ID, TreeManagerType } from "../history/tree-manager";
import { DocumentModelType } from "./document";

// What the content save sender reads from a document's tree manager and tree monitor.

// The most uncommitted entry ids an intermediate save's evidence lists, keeping the newest.
export const kMaxEvidenceEntryIds = 20;

// The state of a concurrent document's history manager that the sender reads.
interface IConcurrentHistoryState {
  readonly applying: boolean;
  readonly isHistorySettled: boolean;
  // The last entry on the shared chain, and its Firestore index when it is known.
  readonly expectedRemoteHead: string | null;
  readonly expectedRemoteHeadIndex: number | undefined;
}

export const getTreeManager = (document: DocumentModelType) =>
  document.treeManagerAPI as TreeManagerType | undefined;

export function getConcurrentHistoryState(document: DocumentModelType) {
  if (!document.concurrent) return undefined;
  return getTreeManager(document)?.historyManager as Partial<IConcurrentHistoryState> | undefined;
}

function isApplyingRemoteEntries(document: DocumentModelType) {
  return !!getConcurrentHistoryState(document)?.applying;
}

/**
 * Whether the content change being reported was made by this user rather than by a concurrent
 * document's apply of remote entries. The apply's calls run with the fake history entry id, and a
 * call is still running when the content reports its change.
 */
export function isLocalChange(document: DocumentModelType) {
  if (!isApplyingRemoteEntries(document)) return true;
  return !!document.treeMonitor?.getRunningCallsWithChanges()
    .some(call => call.historyEntryId !== FAKE_HISTORY_ENTRY_ID);
}

/**
 * The tree manager's open entries that may hold changes the tree monitor doesn't account for:
 * those that have recorded changes, or wait on something other than a finished call, such
 * as a shared model update or an undo. An entry that waits only on the exchanges of finished calls
 * is left to the tree monitor (see hasCallWithUnrecordedChanges), so an entry whose calls changed
 * nothing doesn't count. Many calls briefly open one, such as the sender's own document actions and
 * the setup calls of a tile that was just added.
 */
export function getOpenEntries(document: DocumentModelType) {
  const monitor = document.treeMonitor;
  return getTreeManager(document)?.activeHistoryEntries.filter(entry =>
    entry.records.length > 0 ||
    Array.from(entry.activeExchanges.keys()).some(id => !monitor?.isFinishedCallExchange(id))) ?? [];
}

/**
 * Why a content snapshot taken now might hold changes that no completed history entry describes.
 * Empty when the snapshot is usable.
 */
export function getSnapshotBlockers(document: DocumentModelType): string[] {
  const blockers: string[] = [];
  if (getOpenEntries(document).length > 0) {
    blockers.push("open-entry");
  }
  if (document.treeMonitor?.hasCallWithUnrecordedChanges()) {
    blockers.push("call-with-unrecorded-changes");
  }
  if (isApplyingRemoteEntries(document)) {
    blockers.push("applying-remote-entries");
  }
  // The content holds the load's conversion, which history gets only with the next content change.
  if (getTreeManager(document)?.pendingLoadEntry) {
    blockers.push("pending-load-entry");
  }
  return blockers;
}

/**
 * What may keep the document's content from being exact, recorded with an intermediate save. The
 * envelope is written to the RTDB, which rejects undefined values, so unset fields are left out.
 */
export function collectNotExactEvidence(document: DocumentModelType, uncommittedEntryIds: string[],
    since: number): INotExactEvidence {
  const openEntries = getOpenEntries(document).map(entry => ({
    id: entry.id,
    ...(entry.model !== undefined && { model: entry.model }),
    ...(entry.action !== undefined && { action: entry.action }),
    exchanges: Array.from(entry.activeExchanges.values()),
    openedAt: entry.created.getTime()
  }));
  const runningFlows = (document.treeMonitor?.getRunningCallsWithChanges() ?? [])
    .map(({ action }) => ({ action }));
  const notExactReason = getTreeManager(document)?.exactness.notExactReason;
  return {
    openEntries,
    runningFlows,
    uncommittedEntryIds: uncommittedEntryIds.slice(-kMaxEvidenceEntryIds),
    ...(notExactReason && { notExactReason }),
    since
  };
}
