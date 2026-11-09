import { nanoid } from "nanoid";
import {
  kContentPath, kSharedModelEntryRegex, kSharedModelMapPath, kSharedModelSubtreeRegex, kTileMapPath,
  kTileSubtreeRegex
} from "../document/document-paths";
import { getSharedModelInfoByType } from "../shared/shared-model-registry";
import { getTileContentInfo } from "../tiles/tile-content-info";
import { ISchemaVersionInfo } from "../tiles/schema-version-info";
import { HistoryEntrySnapshot } from "./history";
import { diffJson } from "./json-patch";

export function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Returns the path of the tile or shared model that `patchPath` is at or below, or undefined.
 */
export function getModelPath(patchPath: string): string | undefined {
  const tileMatch = kTileSubtreeRegex.exec(patchPath);
  if (tileMatch) return `${kTileMapPath}/${tileMatch[1]}`;
  const sharedMatch = kSharedModelSubtreeRegex.exec(patchPath);
  if (sharedMatch) return `${kSharedModelMapPath}/${sharedMatch[1]}/sharedModel`;
  return undefined;
}

function getSchemaVersion(modelPath: string, json: any): ISchemaVersionInfo | undefined {
  if (modelPath.startsWith(`${kTileMapPath}/`)) {
    return getTileContentInfo(json?.content?.type)?.schemaVersion;
  }
  return getSharedModelInfoByType(json?.type)?.schemaVersion;
}

/**
 * Converts the model JSON at `modelPath` when it is old: its type registers a schema version, its
 * version isn't current, and its converter accepts it. Returns undefined when the model isn't old,
 * including when the converter declines it. The version check comes first, so the converter runs
 * only when the version differs.
 */
export function convertOldModelJsonAtPath(modelPath: string, json: unknown): unknown {
  if (!isObject(json)) return undefined;
  const info = getSchemaVersion(modelPath, json);
  if (!info) return undefined;
  const version = info.getVersion(json);
  if (version === info.currentVersion) return undefined;
  const converted = info.convertSnapshot(json);
  if (converted !== undefined && process.env.NODE_ENV !== "production") {
    const convertedVersion = info.getVersion(converted);
    if (convertedVersion !== info.currentVersion) {
      console.warn(`Converting the model at ${modelPath} from version "${version}" gave version ` +
        `"${convertedVersion}", not the current version "${info.currentVersion}".`);
    }
  }
  return converted;
}

/**
 * True when the model JSON at `modelPath` has a version that isn't current, whether older or newer.
 * Versions are opaque strings, so only the converter can tell the two apart, and this doesn't run
 * it. A model the converter declines, such as one saved by a newer release, counts too;
 * modelJsonNeedsConversion leaves those out. Use it to skip work, such as cloning, that only an old
 * model needs.
 */
export function isNonCurrentModelJsonAtPath(modelPath: string, json: unknown): boolean {
  if (!isObject(json)) return false;
  const info = getSchemaVersion(modelPath, json);
  return !!info && info.getVersion(json) !== info.currentVersion;
}

/**
 * True when the model JSON at `modelPath` needs conversion: its version isn't current and its
 * converter doesn't decline it. History playback calls such a model old. This runs the converter
 * when the version differs. A model whose conversion throws needs conversion, since the converter
 * didn't decline it; converting it again throws where the caller can report the failure.
 */
export function modelJsonNeedsConversion(modelPath: string, json: unknown): boolean {
  try {
    return convertOldModelJsonAtPath(modelPath, json) !== undefined;
  } catch {
    return true;
  }
}

/**
 * Returns the model JSON at `modelPath` converted when it is old, and unchanged otherwise.
 */
export function convertModelJsonAtPath(modelPath: string, json: unknown): unknown {
  return convertOldModelJsonAtPath(modelPath, json) ?? json;
}

interface IConvertedMap {
  map: any;
  convertedPaths: string[];
}

// The input map is not modified.
function convertModelMap(mapPath: string, map: unknown, getModel: (entry: any) => any,
    setModel: (entry: any, model: any) => any, modelSuffix: string): IConvertedMap {
  const convertedPaths: string[] = [];
  if (!isObject(map)) return { map, convertedPaths };
  let newMap: Record<string, any> | undefined;
  Object.keys(map).forEach(id => {
    const entry = map[id];
    const model = getModel(entry);
    const modelPath = `${mapPath}/${id}${modelSuffix}`;
    const converted = convertOldModelJsonAtPath(modelPath, model);
    if (converted === undefined) return;
    newMap = newMap ?? { ...map };
    newMap[id] = setModel(entry, converted);
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
 * their ancestors up to /content; any other path returns the value unchanged. The value is not
 * modified.
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
  const entryMatch = kSharedModelEntryRegex.exec(path);
  if (entryMatch) {
    const converted = convertOldModelJsonAtPath(`${path}/sharedModel`, value.sharedModel);
    return converted === undefined ? value : { ...value, sharedModel: converted };
  }
  if (path === kContentPath) {
    return convertContentJson(value).content;
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

const kLoadContentAction = "/loadContent";
const kLoadEntryModel = "DocumentContent";

// An entry is uploaded as one Firestore document, and Firestore limits a document to 1 MiB.
const kMaxEntryBytes = 1048576;

/**
 * Builds the load entry, which records the changes CLUE made to the stored content while loading
 * it, as the patches that turn the stored JSON into the loaded JSON. It is flagged `isLoadEntry`
 * and is not undoable.
 */
export function buildLoadEntry(
  treeId: string, changes: { path: string; before: unknown; after: unknown }[]
): HistoryEntrySnapshot {
  const patches = changes.flatMap(({ path, before, after }) => diffJson(before, after, path));
  // TreePatchRecord.getPatches(Undo) reverses inversePatches, so they are stored in reverse
  const inversePatches = changes.flatMap(({ path, before, after }) => diffJson(after, before, path)).reverse();
  const entry: HistoryEntrySnapshot = {
    id: nanoid(),
    // Stamped here, not when the entry is added to a history, so every copy of it shows the same time.
    created: Date.now(),
    tree: treeId,
    model: kLoadEntryModel,
    action: kLoadContentAction,
    undoable: false,
    isLoadEntry: true,
    background: true,
    state: "complete",
    records: [{ tree: treeId, action: kLoadContentAction, patches, inversePatches }]
  };
  // Nothing splits an oversized entry, so log it.
  const size = new TextEncoder().encode(JSON.stringify(entry)).length;
  if (size > kMaxEntryBytes) {
    console.error(`The load entry for document ${treeId} is ${size} bytes, over the ` +
      `${kMaxEntryBytes}-byte limit on a Firestore document, so it can't be uploaded.`);
  }
  return entry;
}
