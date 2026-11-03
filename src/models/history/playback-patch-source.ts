import { IJsonPatch } from "mobx-state-tree";
import { cloneDeep } from "lodash";
import { getEntryPatchesForTree, HistoryEntryType, HistoryOperation } from "./history";
import { JsonHistoryCopy } from "./json-history-copy";
import {
  convertJsonAtPath, convertModelJsonAtPath, getModelPath, isOldModelJsonAtPath
} from "./schema-conversion";

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
 * Thrown by a tree when applying its loads fails. The loads are applied after
 * all of the tree's patches, so playback rolls back the whole move.
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

const kTileMapPath = "/content/tileMap";
const kSharedModelMapPath = "/content/sharedModelMap";

function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sharedModelPathOf(id: string) {
  return `${kSharedModelMapPath}/${id}/sharedModel`;
}

// The paths of the models inside `value`, which is the JSON at the ancestor path `path`.
function getContainedModelPaths(path: string, value: unknown): string[] {
  if (!isObject(value)) return [];
  const tilePaths = (tileMap: unknown) =>
    isObject(tileMap) ? Object.keys(tileMap).map(id => `${kTileMapPath}/${id}`) : [];
  const sharedPaths = (sharedModelMap: unknown) =>
    isObject(sharedModelMap)
      ? Object.keys(sharedModelMap).filter(id => isObject(sharedModelMap[id]?.sharedModel)).map(sharedModelPathOf)
      : [];

  if (path === "/content") return [...tilePaths(value.tileMap), ...sharedPaths(value.sharedModelMap)];
  if (path === kTileMapPath) return tilePaths(value);
  if (path === kSharedModelMapPath) return sharedPaths(value);
  if (path.startsWith(`${kSharedModelMapPath}/`) && path.split("/").length === 4) {
    return isObject(value.sharedModel) ? [sharedModelPathOf(path.split("/")[3])] : [];
  }
  return [];
}

// The JSON at `modelPath` inside `value`, which is the JSON at the ancestor path `path`.
function getJsonWithin(path: string, value: unknown, modelPath: string): unknown {
  let result: any = value;
  for (const segment of modelPath.slice(path.length).split("/").slice(1)) {
    if (!isObject(result)) return undefined;
    result = result[segment];
  }
  return result;
}

// Both directions are read so a model that is added or removed in either one is found.
function getAllPatches(entries: readonly HistoryEntryType[], treeId: string) {
  return entries.flatMap(entry => [
    ...getEntryPatchesForTree(entry, treeId, HistoryOperation.Redo),
    ...getEntryPatchesForTree(entry, treeId, HistoryOperation.Undo)
  ]);
}

/**
 * Returns the model paths of every patch in the entries. A patch at an ancestor of a model, such
 * as a replace of `/content/tileMap`, also contributes every model its value contains.
 */
export function collectModelPaths(entries: readonly HistoryEntryType[], treeId: string): Set<string> {
  const paths = new Set<string>();
  getAllPatches(entries, treeId).forEach(patch => {
    const modelPath = getModelPath(patch.path);
    if (modelPath) {
      paths.add(modelPath);
    } else {
      getContainedModelPaths(patch.path, patch.value).forEach(path => paths.add(path));
    }
  });
  return paths;
}

/**
 * True when any patch at or above `modelPath` carries a value holding an old version of the model.
 */
export function hasOldValue(entries: readonly HistoryEntryType[], treeId: string, modelPath: string): boolean {
  return getAllPatches(entries, treeId).some(patch => {
    if (patch.value === undefined) return false;
    if (patch.path === modelPath) return isOldModelJsonAtPath(modelPath, patch.value);
    if (modelPath.startsWith(`${patch.path}/`)) {
      return isOldModelJsonAtPath(modelPath, getJsonWithin(patch.path, patch.value, modelPath));
    }
    return false;
  });
}

/**
 * A patch source for one tree whose models in `oldPaths` are in an old format at either end of a
 * move. Recorded patches inside those models are dropped. Each such model is instead loaded once,
 * with its state at the copy's position converted to the current format. Other trees use the
 * default source.
 */
export function createOldModelPatchSource(
  args: { copy: JsonHistoryCopy; treeId: string; oldPaths: ReadonlySet<string> }
): IPlaybackPatchSource {
  const { copy, treeId, oldPaths } = args;
  const oldPathList = [...oldPaths];
  let memoPosition: number | undefined;
  let memo = new Map<string, unknown>();

  // Each old model is converted once per position, so an add and the load share the same object.
  const convertedTarget = (path: string) => {
    if (memoPosition !== copy.position) {
      memoPosition = copy.position;
      memo = new Map();
    }
    if (!memo.has(path)) {
      // convert a clone: converters are shallow, so their result can still share nested objects
      // with the input, and the copy's objects must never reach MST
      memo.set(path, convertModelJsonAtPath(path, cloneDeep(copy.getJson(path))));
    }
    return memo.get(path);
  };

  const isAncestorOfOldPath = (path: string) => oldPathList.some(oldPath => oldPath.startsWith(`${path}/`));

  return {
    getPatches(entry, entryTreeId, opType) {
      if (entryTreeId !== treeId) return defaultPatchSource.getPatches(entry, entryTreeId, opType);
      if (entry.isLoadEntry) return [];

      const result: IJsonPatch[] = [];
      getEntryPatchesForTree(entry, treeId, opType).forEach(patch => {
        const modelPath = getModelPath(patch.path);
        if (modelPath && oldPaths.has(modelPath)) {
          if (patch.path !== modelPath) return;
          if (patch.op === "remove") {
            result.push(patch);
          } else {
            const value = copy.getJson(modelPath) !== undefined
              ? convertedTarget(modelPath)
              : convertModelJsonAtPath(modelPath, patch.value);
            result.push({ ...patch, value });
          }
        } else if (!modelPath && patch.value !== undefined && isAncestorOfOldPath(patch.path)) {
          result.push({ ...patch, value: convertJsonAtPath(patch.path, patch.value) });
        } else {
          result.push(patch);
        }
      });
      return result;
    },

    getLoads(loadTreeId) {
      if (loadTreeId !== treeId) return defaultPatchSource.getLoads(loadTreeId);
      return oldPathList
        .filter(path => copy.getJson(path) !== undefined)
        .map(path => ({ op: "replace", path, value: convertedTarget(path) }));
    }
  };
}
