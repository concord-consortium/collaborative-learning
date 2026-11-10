import { IJsonPatch } from "mobx-state-tree";
import { kTileMapPath, kTileSubtreePartsRegex } from "../../../models/document/document-paths";
import { getEntryPatchesForTree, HistoryEntryType, HistoryOperation } from "../../../models/history/history";
import { IHistoryBridge, IVirtualConversion } from "../../../models/history/history-bridges";
import { applyJsonPatches, getJsonAtPath, JsonPatchError } from "../../../models/history/json-patch";
import { getDataflowProgramVersion, STATE_VERSION_RETE_V1 } from "./dataflow-state-versions";

/**
 * Legacy DataFlow tiles (see `getDataflowProgramVersion`) were converted to the current format
 * without a load entry: before load entries were recorded, or in a concurrent document, which
 * doesn't record them yet. Their history goes straight from legacy entries to current ones. This
 * bridge finds that boundary for each tile and rebuilds the legacy tile there, so playback can
 * cross it.
 */

// The program's path inside the tile.
const kProgramPath = "/content/program";

function getTileId(path: string) {
  return kTileSubtreePartsRegex.exec(path)?.[1];
}

function isLegacyProgram(program: any) {
  return program != null && typeof program === "object" &&
    getDataflowProgramVersion(program) === STATE_VERSION_RETE_V1;
}

/**
 * True when a patch on a DataFlow tile uses the legacy program format: a path into the legacy
 * `values` map, a numeric node id, a node's legacy `inputs` or `outputs`, a program, content
 * or tile value holding a legacy program, or the legacy id set on the program.
 */
export function isLegacyDataflowPatch(patch: IJsonPatch): boolean {
  const match = kTileSubtreePartsRegex.exec(patch.path);
  if (!match) return false;
  const rest = match[2];
  const value: any = patch.value;
  if (rest === "") return isLegacyProgram(value?.content?.program);
  if (rest === "/content") return isLegacyProgram(value?.program);
  if (rest === kProgramPath) return isLegacyProgram(value);
  if (rest === `${kProgramPath}/id`) return value === STATE_VERSION_RETE_V1;
  if (!rest.startsWith(`${kProgramPath}/`)) return false;

  const segments = rest.slice(kProgramPath.length + 1).split("/");
  if (segments[0] === "values") return true;
  const nodesIndex = segments.indexOf("nodes");
  if (nodesIndex < 0 || nodesIndex + 1 >= segments.length) return false;
  if (/^\d+$/.test(segments[nodesIndex + 1])) return true;
  return segments.slice(nodesIndex + 2).some(segment => segment === "inputs" || segment === "outputs");
}

function isAtOrUnder(path: string, modelPath: string) {
  return path === modelPath || path.startsWith(`${modelPath}/`);
}

// True when a patch at `path` sets the model at `modelPath` along with what holds it, such as a
// replace of the whole tile map.
function isAbove(path: string, modelPath: string) {
  return modelPath.startsWith(`${path}/`);
}

// The tile that an add or replace at or above the tile path leaves in place, or undefined.
function getTileSetBy(patch: IJsonPatch, tilePath: string) {
  if (patch.op === "remove") return undefined;
  if (!isAtOrUnder(tilePath, patch.path)) return undefined;
  return getJsonAtPath(patch.value, tilePath.slice(patch.path.length));
}

/**
 * Rebuilds a tile's JSON at the end of entry `lastIndex` by replaying its patches forward from the
 * last entry with a patch that adds or replaces the whole tile, or a model holding it. Returns
 * undefined when there is no such entry, or the tile is gone or a patch doesn't apply after it.
 */
function rebuildTileJson(
  patchesByEntry: readonly (readonly IJsonPatch[])[], tilePath: string, lastIndex: number
): unknown {
  const setsTile = (patch: IJsonPatch) => getTileSetBy(patch, tilePath) !== undefined;
  let addIndex = lastIndex;
  while (addIndex >= 0 && !patchesByEntry[addIndex].some(setsTile)) addIndex--;
  if (addIndex < 0) return undefined;

  // The patches are applied to a document that holds only the tile map, so a patch above the tile
  // path applies as recorded.
  const documentJson = kTileMapPath.split("/").slice(1)
    .reduceRight<object>((inner, key) => ({ [key]: inner }), {});
  const addPatches = patchesByEntry[addIndex];
  const addPatchIndex = addPatches.findIndex(setsTile);
  // The first add and the patches after it in its own entry, then those in the later entries.
  const patches = [addPatches.slice(addPatchIndex), ...patchesByEntry.slice(addIndex + 1, lastIndex + 1)];
  try {
    patches.forEach(entryPatches => {
      applyJsonPatches(documentJson, entryPatches.filter(patch =>
        isAtOrUnder(patch.path, tilePath) || isAbove(patch.path, tilePath)));
    });
  } catch (error) {
    if (error instanceof JsonPatchError) return undefined;
    throw error;
  }
  return getJsonAtPath(documentJson, tilePath);
}

// True when a load entry converts the tile from legacy: its forward or inverse patches on the tile
// include a legacy patch. A conversion of a legacy program with no nodes and no `values` map has
// a legacy patch only in its inverse, which sets the legacy program id back.
function convertsLegacyTile(entry: HistoryEntryType, treeId: string, tilePath: string) {
  return [HistoryOperation.Redo, HistoryOperation.Undo].some(opType =>
    getEntryPatchesForTree(entry, treeId, opType)
      .some(patch => isAtOrUnder(patch.path, tilePath) && isLegacyDataflowPatch(patch)));
}

// The tile just before `entry`, taken from the entry's undo patches, when they set the whole tile
// and it holds a legacy program, such as when the entry deletes the legacy tile.
function getLegacyTileBefore(entry: HistoryEntryType, treeId: string, tilePath: string) {
  const undoPatches = getEntryPatchesForTree(entry, treeId, HistoryOperation.Undo);
  const tile: any = rebuildTileJson([undoPatches], tilePath, 0);
  return isLegacyProgram(tile?.content?.program) ? tile : undefined;
}

/**
 * Puts a virtual conversion after each tile's last legacy entry. Load entries don't count as
 * legacy entries, although a load entry that converts a legacy tile has legacy patches. When the
 * next entry that touches the tile is a load entry that converts it from legacy, the history
 * records the conversion, and the tile needs no virtual conversion. A load entry from a later
 * schema change doesn't cover it.
 *
 * The tile's old JSON is rebuilt from its patches. When that fails, such as when the history
 * doesn't hold the tile's add, it is taken from the next entry's undo patches if they set the
 * legacy tile.
 */
export const legacyDataflowHistoryBridge: IHistoryBridge = {
  findVirtualConversions(history: readonly HistoryEntryType[], treeId: string): IVirtualConversion[] {
    const patchesByEntry = history.map(entry => getEntryPatchesForTree(entry, treeId, HistoryOperation.Redo));

    const lastLegacyIndex = new Map<string, number>();
    patchesByEntry.forEach((patches, index) => {
      if (history[index].isLoadEntry) return;
      patches.forEach(patch => {
        if (!isLegacyDataflowPatch(patch)) return;
        const tileId = getTileId(patch.path);
        if (tileId) lastLegacyIndex.set(tileId, index);
      });
    });

    const conversions: IVirtualConversion[] = [];
    lastLegacyIndex.forEach((lastLegacy, tileId) => {
      const tilePath = `${kTileMapPath}/${tileId}`;
      const next = patchesByEntry.findIndex((patches, index) => index > lastLegacy &&
        patches.some(patch => isAtOrUnder(patch.path, tilePath) || isAbove(patch.path, tilePath)));
      const nextEntry = next >= 0 ? history[next] : undefined;
      if (nextEntry?.isLoadEntry && convertsLegacyTile(nextEntry, treeId, tilePath)) return;
      const oldJson = rebuildTileJson(patchesByEntry, tilePath, lastLegacy) ??
        (nextEntry && getLegacyTileBefore(nextEntry, treeId, tilePath));
      conversions.push({ path: tilePath, position: lastLegacy + 1, oldJson });
    });
    return conversions;
  }
};
