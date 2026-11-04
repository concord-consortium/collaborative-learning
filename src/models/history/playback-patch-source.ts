import { IJsonPatch } from "mobx-state-tree";
import { getEntryPatchesForTree, HistoryEntryType, HistoryOperation } from "./history";

/**
 * Where `TreeManager.goToHistoryEntryPosition` gets the patches it applies
 * to each tree during a playback move.
 *
 * `getPatches` returns the patches a tree receives for one history entry in
 * the given direction. It is used both to build the batched move and to
 * build the rollback after a failure, so the two stay in step.
 *
 * `getLoads` returns whole-model `replace` patches a tree applies after the
 * move's patches, in the same action. A source uses them to set models whose
 * recorded patches it left out, such as tiles saved in an older schema.
 */
export interface IPlaybackPatchSource {
  getPatches(entry: HistoryEntryType, treeId: string, opType: HistoryOperation): IJsonPatch[];
  getLoads(treeId: string): IJsonPatch[];
}

/**
 * Applies each entry's recorded patches as they are, with no loads. A conversion entry is never
 * applied to an MST tree, so it has no patches here.
 */
export const defaultPatchSource: IPlaybackPatchSource = {
  getPatches: (entry, treeId, opType) => entry.isLoadEntry ? [] : getEntryPatchesForTree(entry, treeId, opType),
  getLoads: () => []
};

/**
 * Thrown by a tree when applying its loads fails. Unlike a
 * PatchApplicationError there is no count of applied patches to roll back
 * from, so playback treats it as an unexpected error.
 */
export class LoadApplicationError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`Load application failed: ${message}`);
    this.name = "LoadApplicationError";
    this.cause = cause;
  }
}
