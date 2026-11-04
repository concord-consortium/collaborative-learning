import { IJsonPatch } from "mobx-state-tree";
import { HistoryEntryType } from "../../../models/history/history";
import { IHistoryBridge, IVirtualConversion } from "../../../models/history/history-bridges";
import { applyJsonPatches, JsonPatchError, toJsonValue } from "../../../models/history/json-patch";
import { getDataflowProgramVersion, STATE_VERSION_RETE_V1 } from "./dataflow-state-versions";

/**
 * Legacy DataFlow tiles (program `dataflow@0.1.0`, or a program with no id and a `values` map)
 * were converted to the current format before history recorded load entries, so their
 * history goes straight from legacy entries to current ones. This bridge finds that boundary for
 * each tile and rebuilds the legacy tile there, so playback can cross it.
 */

const kTilePathPattern = /^\/content\/tileMap\/([^/]+)(.*)$/;
const kProgramPath = "/content/program";

function getTileId(path: string) {
  return kTilePathPattern.exec(path)?.[1];
}

function isLegacyProgram(program: any) {
  return program != null && typeof program === "object" &&
    getDataflowProgramVersion(program) === STATE_VERSION_RETE_V1;
}

/**
 * True when a patch on a DataFlow tile uses the legacy program format: a path into the legacy
 * `values` map, a numeric node id, a node's legacy `inputs` or `outputs`, a program, content
 * or tile value holding a legacy program (with the legacy id, or with no id and a `values` map),
 * or the legacy id set on the program.
 */
export function isLegacyDataflowPatch(patch: IJsonPatch): boolean {
  const match = kTilePathPattern.exec(patch.path);
  if (!match) return false;
  const rest = match[2];
  const value: any = patch.value;
  if (rest === "") return isLegacyProgram(value?.content?.program);
  if (rest === "/content") return isLegacyProgram(value?.program);
  if (rest === kProgramPath) return isLegacyProgram(value);
  if (rest === `${kProgramPath}/id`) return value === STATE_VERSION_RETE_V1;
  if (!rest.startsWith(`${kProgramPath}/`)) return false;

  const segments = rest.slice(kProgramPath.length + 1).split("/");
  if (segments[0] === "values" && segments.length > 1) return true;
  const nodesIndex = segments.indexOf("nodes");
  if (nodesIndex < 0 || nodesIndex + 1 >= segments.length) return false;
  if (/^\d+$/.test(segments[nodesIndex + 1])) return true;
  return segments.slice(nodesIndex + 2).some(segment => segment === "inputs" || segment === "outputs");
}

function getForwardPatches(entry: HistoryEntryType, treeId: string): readonly IJsonPatch[] {
  return entry.records.filter(record => record.tree === treeId).flatMap(record => record.patches);
}

function isAtOrUnder(path: string, modelPath: string) {
  return path === modelPath || path.startsWith(`${modelPath}/`);
}

/**
 * Rebuilds a tile's JSON at the end of entry `lastIndex` by replaying its patches forward from the
 * last patch that adds or replaces the whole tile. Returns undefined when there is no such patch
 * or a patch doesn't apply.
 */
function rebuildTileJson(
  patchesByEntry: readonly (readonly IJsonPatch[])[], tilePath: string, lastIndex: number
): unknown {
  const isWholeTile = (patch: IJsonPatch) => patch.path === tilePath && (patch.op === "add" || patch.op === "replace");
  let addIndex = lastIndex;
  while (addIndex >= 0 && !patchesByEntry[addIndex].some(isWholeTile)) addIndex--;
  if (addIndex < 0) return undefined;

  // The tile is kept under a wrapper so a patch at the tile path can replace or remove it.
  const kWrapperPath = "/tile";
  const rebase = (patch: IJsonPatch): IJsonPatch =>
    ({ ...patch, path: kWrapperPath + patch.path.slice(tilePath.length) });
  const addPatches = patchesByEntry[addIndex];
  const addPatchIndex = addPatches.length - 1 - [...addPatches].reverse().findIndex(isWholeTile);
  const wrapper: { tile?: unknown } = { tile: toJsonValue(addPatches[addPatchIndex].value) };
  // The patches after the add in its own entry, then those in the later entries.
  const later = [addPatches.slice(addPatchIndex + 1), ...patchesByEntry.slice(addIndex + 1, lastIndex + 1)];
  try {
    later.forEach(patches => {
      applyJsonPatches(wrapper, patches.filter(patch => isAtOrUnder(patch.path, tilePath)).map(rebase));
    });
  } catch (error) {
    if (error instanceof JsonPatchError) return undefined;
    throw error;
  }
  return wrapper.tile;
}

export const legacyDataflowHistoryBridge: IHistoryBridge = {
  findVirtualConversions(history: readonly HistoryEntryType[], treeId: string): IVirtualConversion[] {
    const patchesByEntry = history.map(entry => getForwardPatches(entry, treeId));

    const lastLegacyIndex = new Map<string, number>();
    patchesByEntry.forEach((patches, index) => {
      patches.forEach(patch => {
        if (!isLegacyDataflowPatch(patch)) return;
        const tileId = getTileId(patch.path);
        if (tileId) lastLegacyIndex.set(tileId, index);
      });
    });

    const conversions: IVirtualConversion[] = [];
    lastLegacyIndex.forEach((lastLegacy, tileId) => {
      const tilePath = `/content/tileMap/${tileId}`;
      // A stored load entry after the legacy entries already covers the tile.
      const isCovered = history.some((entry, index) => index > lastLegacy && entry.isLoadEntry &&
        patchesByEntry[index].some(patch => isAtOrUnder(patch.path, tilePath)));
      if (isCovered) return;
      conversions.push({
        path: tilePath,
        position: lastLegacy + 1,
        oldJson: rebuildTileJson(patchesByEntry, tilePath, lastLegacy)
      });
    });
    return conversions;
  }
};
