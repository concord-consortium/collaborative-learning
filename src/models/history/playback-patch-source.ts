import { IJsonPatch } from "mobx-state-tree";
import { cloneDeep } from "lodash";
import {
  kContentPath, kSharedModelEntryRegex, kSharedModelMapPath, kTileMapPath
} from "../document/document-paths";
import { getEntryPatchesForTree, HistoryEntryType, HistoryOperation } from "./history";
import { JsonHistoryCopy } from "./json-history-copy";
import {
  convertJsonAtPath, convertModelJsonAtPath, getModelPath, isObject, modelJsonNeedsConversion
} from "./schema-conversion";

/**
 * Where `TreeManager.goToHistoryEntryPosition` gets the patches it applies
 * to each tree during a playback move.
 *
 * History entries record what happened, in whatever format the document had
 * then. A patch source turns that record into patches the current MST models
 * accept. The default source passes the record through unchanged, apart
 * from giving load entries no patches.
 */
export interface IPlaybackPatchSource {
  /**
   * Returns the patches a tree receives for one history entry in the given
   * direction. It is used both to build the batched move and to build the
   * rollback after a failure, so the two stay in step.
   */
  getPatches(entry: HistoryEntryType, treeId: string, opType: HistoryOperation): IJsonPatch[];
  /**
   * Returns model replacements: whole-model `replace` patches a tree applies
   * after the move's patches, in the same action. Each one sets a model, in
   * place, to its state at the move's target. A source uses them for models
   * whose recorded patches it left out, such as tiles saved in an older
   * schema. This is also how playback crosses a load entry: a tree gets no
   * patches for the entry, so each model it changed is replaced instead. A
   * model replacement is not itself a history entry; the source builds it for
   * one move.
   */
  getModelReplacements(treeId: string): IJsonPatch[];
}

/**
 * Applies each entry's recorded patches as they are, with no model replacements. Playback never
 * applies a load entry to an MST tree, so it has no patches here.
 */
export const defaultPatchSource: IPlaybackPatchSource = {
  getPatches: (entry, treeId, opType) => entry.isLoadEntry ? [] : getEntryPatchesForTree(entry, treeId, opType),
  getModelReplacements: () => []
};

/**
 * Thrown by a tree when applying its model replacements fails, after all of its patches have
 * applied.
 */
export class ModelReplacementError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`Replacing a model failed: ${message}`);
    this.name = "ModelReplacementError";
    this.cause = cause;
  }
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

  if (path === kContentPath) return [...tilePaths(value.tileMap), ...sharedPaths(value.sharedModelMap)];
  if (path === kTileMapPath) return tilePaths(value);
  if (path === kSharedModelMapPath) return sharedPaths(value);
  const entryMatch = kSharedModelEntryRegex.exec(path);
  if (entryMatch) {
    return isObject(value.sharedModel) ? [sharedModelPathOf(entryMatch[1])] : [];
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

/**
 * The patches of the entries for one tree, in both directions, so a model that is added or removed
 * in either one is found.
 */
export function getAllPatches(entries: readonly HistoryEntryType[], treeId: string) {
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
 * True when any of the patches at or above `modelPath` carries a value holding the model in an old
 * format, one its converter accepts.
 */
export function hasOldValue(patches: readonly IJsonPatch[], modelPath: string): boolean {
  return patches.some(patch => {
    if (patch.value === undefined) return false;
    if (patch.path === modelPath) return modelJsonNeedsConversion(modelPath, patch.value);
    if (modelPath.startsWith(`${patch.path}/`)) {
      return modelJsonNeedsConversion(modelPath, getJsonWithin(patch.path, patch.value, modelPath));
    }
    return false;
  });
}

/**
 * A patch source for one tree that replaces the models in `oldPaths` instead of patching them.
 * Patches inside those models are dropped, and patches at or above them carry converted values.
 * Each one that exists at the copy's position gets one model replacement with its state there,
 * converted when it is old. Other trees use the default source.
 */
export function createOldModelPatchSource(
  args: { copy: JsonHistoryCopy; treeId: string; oldPaths: ReadonlySet<string> }
): IPlaybackPatchSource {
  const { copy, treeId, oldPaths } = args;
  const oldPathList = [...oldPaths];
  let memoPosition: number | undefined;
  let memo = new Map<string, unknown>();

  // Each model's target state is built once per position, so an add and the replacement share the
  // same object. getConvertedModel already caches an old model; this saves cloning one that isn't
  // old.
  const convertedTarget = (path: string) => {
    if (memoPosition !== copy.position) {
      memoPosition = copy.position;
      memo = new Map();
    }
    if (!memo.has(path)) {
      // A model that isn't old at the target, such as one its converter declines, is replaced
      // with its state as the copy has it, cloned so the copy's objects never reach MST.
      memo.set(path, copy.getConvertedModel(path) ?? cloneDeep(copy.getJson(path)));
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

    getModelReplacements(replacementTreeId) {
      if (replacementTreeId !== treeId) return defaultPatchSource.getModelReplacements(replacementTreeId);
      return oldPathList
        .filter(path => copy.getJson(path) !== undefined)
        .map(path => ({ op: "replace", path, value: convertedTarget(path) }));
    }
  };
}
