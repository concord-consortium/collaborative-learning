import { nanoid } from "nanoid";
import { HistoryEntrySnapshot, TreePatchRecordSnapshot } from "./history";

/**
 * Build a snapshot for a revert entry. Used by the fork-resolution
 * rollback path: each original that needs to be rolled back gets one
 * revert entry appended to local history.
 *
 * Currently for debugging only. The revert entry records that a
 * rollback happened (visible in the history viewer) but its patches
 * are not separately applied to the document — the rollback's state
 * mutation happens via an aggregate inverse-patch apply in
 * `rollbackLocalEntries`. The history scrubber does not currently
 * support traversing local history that contains revert entries.
 *
 * Records are reversed; within each record the `patches` and
 * `inversePatches` arrays are swapped AND each is reversed. This
 * matches the way `TreePatchRecord.getPatches(Undo)` builds its patch
 * list (records reversed, inversePatches reversed) so the revert's
 * forward-apply would mirror the original's undo-apply if it were
 * applied directly.
 *
 * Known limitation: the inverse patches on the revert are the
 * original's forward patches (reversed). This is correct only while
 * scope-disjoint is the merge rule — no other entry can have modified
 * the paths between the original's apply and the rollback. To support
 * more fine-grained merges, these revert entries could be built using
 * live MST recording. See phase 2 of
 * docs/superpowers/specs/2026-04-24-fork-detection-rollback-recording-design.md.
 */
export function buildRevertEntrySnapshot(
  original: HistoryEntrySnapshot,
  triggeringBatchIds: string[]
): HistoryEntrySnapshot {
  const originalRecords = original.records ?? [];
  const revertRecords: TreePatchRecordSnapshot[] = [...originalRecords]
    .reverse()
    .map(record => ({
      tree: record.tree,
      action: record.action,
      patches: [...(record.inversePatches ?? [])].reverse(),
      inversePatches: [...(record.patches ?? [])].reverse(),
    }));

  return {
    id: nanoid(),
    tree: original.tree,
    model: original.model,
    action: original.action,
    undoable: false,
    state: "complete",
    records: revertRecords,
    isRevert: true,
    revertsEntryId: original.id,
    triggeringBatchIds,
  };
}
