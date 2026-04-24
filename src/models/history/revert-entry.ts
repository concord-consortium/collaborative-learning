import { nanoid } from "nanoid";
import { HistoryEntrySnapshot, TreePatchRecordSnapshot } from "./history";

/**
 * Build a snapshot for a revert entry that, when applied forward,
 * undoes `original`. Used by the fork-resolution rollback path: each
 * original that needs to be rolled back gets one revert entry appended
 * to local history.
 *
 * Records are reversed; within each record the `patches` and
 * `inversePatches` arrays are swapped AND each is reversed. This
 * matches the way `TreePatchRecord.getPatches(Undo)` builds its patch
 * list (records reversed, inversePatches reversed) so the revert's
 * forward-apply mirrors the original's undo-apply.
 *
 * Phase-1 limitation: the inverse patches on the revert are the
 * original's forward patches (reversed). This is correct only while
 * scope-disjoint is the merge rule — no other entry can have modified
 * the paths between the original's apply and the rollback. Phase 2
 * rebuilds records via live MST recording instead.
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
