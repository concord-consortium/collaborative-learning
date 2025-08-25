import { ITileMetadataModel, TileMetadataModel } from "./tile-metadata";
import { TileContentModel, ITileContentModel } from "./tile-content";
import { IClueObjectSnapshot } from "../annotations/clue-object";
import { AppConfigModelType } from "../stores/app-config-model";
import { UpdatedSharedDataSetIds } from "../shared/shared-data-set";
import { SharedModelEntrySnapshotType } from "../document/shared-model-entry";
import { ITileModel } from "./tile-model";

export interface IDefaultContentOptions {
  // title is only currently used by the Geometry and Table tiles
  title?: string;
  // url is added so the CLUE core can add an image tile to the document when a user
  // drops an image on the document.
  url?: string;
  // appConfig contains stamps (for drawing tool), placeholderText (for text tool), etc.
  appConfig?: AppConfigModelType;
  // a factory method for creating additional tiles needed
  tileFactory?: (toolId: string) => ITileModel;
}

type TileModelSnapshotPreProcessor = (tile: any) => any

type TileContentSnapshotPostProcessor =
      (content: any, idMap: Record<string, string>, asTemplate?: boolean) => any;

type TileContentNewSharedModelIdUpdater = (
  content: any,
  sharedModelEntries: SharedModelEntrySnapshotType[],
  updatedSharedModelMap: Record<string, UpdatedSharedDataSetIds>
) => any;

type ClueObjectNewSharedModelIdUpdater = (
  clueObject: IClueObjectSnapshot,
  sharedModelEntries: SharedModelEntrySnapshotType[],
  updatedSharedModelMap: Record<string, UpdatedSharedDataSetIds>
) => any;

export interface ITileContentInfo {
  type: string;
  modelClass: typeof TileContentModel;
  defaultContent: (options?: IDefaultContentOptions) => ITileContentModel;
  /**
   * used for the title of the toolbar button and the title of the heading in
   * the sort work tab. If not set, the type is used.
   */
  displayName?: string;
  /**
   * A shorter version of the name of the tile.
   * This is used for action buttons, like "Graph It!"
   * If not set, the displayName is used.
   */
  shortName?: string;
  /**
   * used as the prefix when naming a new tile of this type, if titleBase
   * isn't set the displayName or shortName is used.
   * If none are not set then the type is used.
   */
  titleBase?: string;
  /**
   * If true, the tile uses a title specified by its content rather than in the tile model itself.
   * Currently the tiles that specify this all use the name of a linked DataSet as the title.
   */
  useContentTitle?: boolean;
  metadataClass?: typeof TileMetadataModel;
  defaultHeight?: number;
  exportNonDefaultHeight?: boolean;
  /**
   * If true, the tile can contain other tiles.
   */
  isContainer?: boolean;
  isDataConsumer?: boolean;
  isDataProvider?: boolean;
  isVariableProvider?: boolean;
  consumesMultipleDataSets?: (appConfig: AppConfigModelType) => boolean;
  tileSnapshotPreProcessor?: TileModelSnapshotPreProcessor;
  contentSnapshotPostProcessor?: TileContentSnapshotPostProcessor;
  updateContentWithNewSharedModelIds?: TileContentNewSharedModelIdUpdater;
  updateObjectReferenceWithNewSharedModelIds?: ClueObjectNewSharedModelIdUpdater;
  /**
   * If supplied, this function is called when a tile is being copied.
   * This allows tiles to handle any special logic needed beyond the standard updates of IDs.
   * For example, the Question tile uses this to ensure it's locked when copied across documents.
   * Returns the updated content.
   */
  updateContentForCopy?: (content: any, acrossDocuments: boolean) => any;
}

const gTileContentInfoMap: Record<string, ITileContentInfo> = {};

export function registerTileContentInfo(tileContentInfo: ITileContentInfo) {
  const { type, displayName, titleBase } = tileContentInfo;
  // toLowerCase() for legacy support of tool names
  gTileContentInfoMap[type.toLowerCase()] = tileContentInfo;
  if (displayName && !titleBase) {
    tileContentInfo.titleBase = displayName;
  }
}

// ToolContent type, e.g. kDrawingTileType, kGeometryTileType, etc.
// undefined is supported so callers do not need to check the id before passing
// it in.
export function getTileContentInfo(type?: string) {
  // toLowerCase() for legacy support of tool names
  return type ? gTileContentInfoMap[type.toLowerCase()] : undefined;
}

export function getTileContentModels() {
  return Object.values(gTileContentInfoMap).map(info => info.modelClass);
}

export function getTileTypes() {
  // the keys are toLowerCased(), so we look up the actual id
  return Object.values(gTileContentInfoMap).map(info => info.type);
}

export function getTileCreateActionName(type?: string) {
  const info = getTileContentInfo(type);
  const bestName = info?.shortName || info?.displayName || type || "Create";
  return `${bestName} It!`;
}

export interface ITileExportOptions {
  json?: boolean; // default true, but some tiles (e.g. geometry) use their export code to produce other formats
  includeId?: boolean;
  excludeTitle?: boolean;
  rowHeight?: number;
  transformImageUrl?: (url: string, filename?: string) => string;
  appendComma?: boolean;
  forHash?: boolean;
}

export interface IDocumentExportOptions extends ITileExportOptions {
  includeTileIds?: boolean;
  appendComma?: boolean;
  transformImageUrl?: (url: string, filename?: string) => string;
}

export function isRegisteredTileType(type: string) {
  return !!getTileContentInfo(type);
}

/*
 * tile metadata
 */
interface IPrivate {
  metadata: Record<string, ITileMetadataModel>;
}

export const _private: IPrivate = {
  metadata: {}
};
export function findMetadata(type: string, id: string) {
  const MetadataType = getTileContentInfo(type)?.metadataClass;
  if (!MetadataType) return;

  if (!_private.metadata[id]) {
    _private.metadata[id] = MetadataType.create({ id });
  }
  return _private.metadata[id];
}
