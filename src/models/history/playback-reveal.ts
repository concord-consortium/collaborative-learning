import { IJsonPatch } from "mobx-state-tree";
import { DocumentContentModelType } from "../document/document-content";
import {
  kContainerRowsSubpathRegex, kRowSubtreeRegex, kSharedModelEntrySubtreeRegex, kTileSubtreePartsRegex,
  kUpdatedHashSubpath
} from "../document/document-paths";
import { isBackgroundEntry } from "./background-entries";
import { getEntryPatchesForTree, HistoryEntryType, HistoryOperation } from "./history";

/**
 * The tile a set of patches changed that exists in `content`, for history playback to bring on
 * screen. A tile the patches changed comes first, then a tile linked to a shared model they
 * changed, then a tile in a row they changed (inside a container tile too), then a container tile
 * whose rows they changed. Within each, the first in patch order wins.
 */
export function getChangedTileId(patches: readonly IJsonPatch[], content: DocumentContentModelType) {
  const tileIds: string[] = [];
  const sharedModelIds: string[] = [];
  const rowIds: string[] = [];
  const containerIds: string[] = [];
  patches.forEach(({ path }) => {
    const tileMatch = kTileSubtreePartsRegex.exec(path);
    if (tileMatch) {
      const [, tileId, subpath] = tileMatch;
      const containerRowsMatch = kContainerRowsSubpathRegex.exec(subpath);
      if (containerRowsMatch) {
        if (containerRowsMatch[1]) rowIds.push(containerRowsMatch[1]);
        containerIds.push(tileId);
      } else if (subpath !== kUpdatedHashSubpath) {
        // Every tile linked to a shared model gets an `updatedHash` patch when the shared model
        // changes, whatever changed, so that patch alone does not mark the tile as changed.
        tileIds.push(tileId);
      }
      return;
    }
    const sharedMatch = kSharedModelEntrySubtreeRegex.exec(path);
    if (sharedMatch) {
      sharedModelIds.push(sharedMatch[1]);
      return;
    }
    const rowMatch = kRowSubtreeRegex.exec(path);
    if (rowMatch) rowIds.push(rowMatch[1]);
  });
  const linkedTileIds = sharedModelIds.flatMap(id => content.sharedModelMap.get(id)?.tiles.map(tile => tile.id) ?? []);
  const rowTileIds = rowIds.flatMap(id => content.getRowRecursive(id)?.tileIds ?? []);
  return [...tileIds, ...linkedTileIds, ...rowTileIds, ...containerIds].find(id => content.getTile(id));
}

/**
 * The tile a playback move from history position `from` to `to` changed, as `getChangedTileId`
 * picks it from the entry nearest the move's end: the last one applied going forward, the last
 * one undone going backward. Background entries (program ticks, load entries) are passed over,
 * since the slider shows only the changes people made. `content` is the document after the move.
 */
export function getPlaybackRevealTileId(args: {
  history: { at(index: number): HistoryEntryType | undefined };
  treeId: string;
  from: number;
  to: number;
  content: DocumentContentModelType;
}) {
  const { history, treeId, from, to, content } = args;
  const forward = to > from;
  const opType = forward ? HistoryOperation.Redo : HistoryOperation.Undo;
  const step = forward ? -1 : 1;
  for (let index = forward ? to - 1 : to; forward ? index >= from : index < from; index += step) {
    const entry = history.at(index);
    if (entry && !isBackgroundEntry(entry)) {
      return getChangedTileId(getEntryPatchesForTree(entry, treeId, opType), content);
    }
  }
  return undefined;
}
