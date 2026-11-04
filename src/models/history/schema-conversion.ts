import { nanoid } from "nanoid";
import { getSharedModelInfoByType } from "../shared/shared-model-registry";
import { getTileContentInfo } from "../tiles/tile-content-info";
import { ISchemaVersionInfo } from "../tiles/schema-version-info";
import { HistoryEntrySnapshot } from "./history";
import { diffJson } from "./json-patch";

const kTileMapPath = "/content/tileMap";
const kSharedModelMapPath = "/content/sharedModelMap";

const tilePathRegex = /^\/content\/tileMap\/([^/]+)(\/|$)/;
const sharedModelPathRegex = /^\/content\/sharedModelMap\/([^/]+)\/sharedModel(\/|$)/;

function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Returns the path of the tile or shared model that `patchPath` is at or below, or undefined.
 */
export function getModelPath(patchPath: string): string | undefined {
  const tileMatch = tilePathRegex.exec(patchPath);
  if (tileMatch) return `${kTileMapPath}/${tileMatch[1]}`;
  const sharedMatch = sharedModelPathRegex.exec(patchPath);
  if (sharedMatch) return `${kSharedModelMapPath}/${sharedMatch[1]}/sharedModel`;
  return undefined;
}

function getSchemaVersion(modelPath: string, json: any): ISchemaVersionInfo | undefined {
  if (modelPath.startsWith(`${kTileMapPath}/`)) {
    return getTileContentInfo(json?.content?.type)?.schemaVersion;
  }
  return getSharedModelInfoByType(json?.type)?.schemaVersion;
}

export function isOldModelJsonAtPath(modelPath: string, json: unknown): boolean {
  if (!isObject(json)) return false;
  const info = getSchemaVersion(modelPath, json);
  return !!info && info.getVersion(json) !== info.currentVersion;
}

export function convertModelJsonAtPath(modelPath: string, json: unknown): unknown {
  if (!isObject(json)) return json;
  const info = getSchemaVersion(modelPath, json);
  if (!info || info.getVersion(json) === info.currentVersion) return json;
  // look up convertSnapshot at call time so it can be spied on
  return info.convertSnapshot(json);
}

interface IConvertedMap {
  map: any;
  convertedPaths: string[];
}

// Converts the old models in a map of models. The input map is not modified.
function convertModelMap(mapPath: string, map: unknown, getModel: (entry: any) => any,
    setModel: (entry: any, model: any) => any, modelSuffix: string): IConvertedMap {
  const convertedPaths: string[] = [];
  if (!isObject(map)) return { map, convertedPaths };
  let newMap: Record<string, any> | undefined;
  Object.keys(map).forEach(id => {
    const entry = map[id];
    const model = getModel(entry);
    const modelPath = `${mapPath}/${id}${modelSuffix}`;
    if (!isOldModelJsonAtPath(modelPath, model)) return;
    newMap = newMap ?? { ...map };
    newMap[id] = setModel(entry, convertModelJsonAtPath(modelPath, model));
    convertedPaths.push(modelPath);
  });
  return { map: newMap ?? map, convertedPaths };
}

function convertTileMap(tileMap: unknown) {
  return convertModelMap(kTileMapPath, tileMap, entry => entry, (_entry, model) => model, "");
}

function convertSharedModelMap(sharedModelMap: unknown) {
  return convertModelMap(kSharedModelMapPath, sharedModelMap,
    entry => entry?.sharedModel, (entry, sharedModel) => ({ ...entry, sharedModel }), "/sharedModel");
}

/**
 * Converts the old models inside `value`, which is the JSON at `path`. Handles model paths and
 * their ancestors; any other path returns the value unchanged. The value is not modified.
 */
export function convertJsonAtPath(path: string, value: unknown): unknown {
  if (!isObject(value)) return value;

  const modelPath = getModelPath(path);
  if (modelPath) {
    // only the model itself can be converted; a path below the model holds part of a model
    return modelPath === path ? convertModelJsonAtPath(modelPath, value) : value;
  }

  if (path === kTileMapPath) {
    return convertTileMap(value).map;
  }
  if (path === kSharedModelMapPath) {
    return convertSharedModelMap(value).map;
  }
  if (path.startsWith(`${kSharedModelMapPath}/`) && path.split("/").length === 4) {
    const id = path.split("/")[3];
    const sharedPath = `${kSharedModelMapPath}/${id}/sharedModel`;
    if (!isOldModelJsonAtPath(sharedPath, value.sharedModel)) return value;
    return { ...value, sharedModel: convertModelJsonAtPath(sharedPath, value.sharedModel) };
  }
  if (path === "/content") {
    const tiles = convertTileMap(value.tileMap);
    const shared = convertSharedModelMap(value.sharedModelMap);
    if (!tiles.convertedPaths.length && !shared.convertedPaths.length) return value;
    return { ...value, tileMap: tiles.map, sharedModelMap: shared.map };
  }
  return value;
}

/**
 * Converts the old tiles and shared models in a document's content JSON. The input is not
 * modified. When nothing is old, the same object is returned with no converted paths.
 */
export function convertContentJson(content: any): { content: any; convertedPaths: string[] } {
  if (!isObject(content)) return { content, convertedPaths: [] };
  const tiles = convertTileMap(content.tileMap);
  const shared = convertSharedModelMap(content.sharedModelMap);
  const convertedPaths = [...tiles.convertedPaths, ...shared.convertedPaths];
  if (!convertedPaths.length) return { content, convertedPaths };
  const newContent: Record<string, any> = { ...content };
  if (content.tileMap) newContent.tileMap = tiles.map;
  if (content.sharedModelMap) newContent.sharedModelMap = shared.map;
  return { content: newContent, convertedPaths };
}

const kConvertSchemasAction = "/convertSchemas";

/**
 * Builds the entry that records the conversion of old models to the current format, as the
 * patches that turn the stored JSON into the converted JSON. It is flagged `isConversion` and
 * is not undoable.
 */
export function buildConversionEntry(
  treeId: string, changes: { path: string; before: unknown; after: unknown }[]
): HistoryEntrySnapshot {
  const patches = changes.flatMap(({ path, before, after }) => diffJson(before, after, path));
  // TreePatchRecord.getPatches(Undo) reverses inversePatches, so they are stored in reverse
  const inversePatches = changes.flatMap(({ path, before, after }) => diffJson(after, before, path)).reverse();
  return {
    id: nanoid(),
    created: Date.now(),
    tree: treeId,
    model: "DocumentContent",
    action: kConvertSchemasAction,
    undoable: false,
    isConversion: true,
    background: true,
    state: "complete",
    records: [{ tree: treeId, action: kConvertSchemasAction, patches, inversePatches }]
  };
}
