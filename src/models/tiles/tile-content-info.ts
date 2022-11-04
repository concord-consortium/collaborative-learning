import { ToolMetadataModel } from "./tile-metadata";
import { ToolContentModel, ToolContentModelType } from "./tile-types";
import { AppConfigModelType } from "../stores/app-config-model";

export interface IDMap {
  [id: string]: string;
}
export type ToolTileModelContentSnapshotPostProcessor =
              (content: any, idMap: IDMap, asTemplate?: boolean) => any;

export interface IDefaultContentOptions {
  // title is only currently used by the Geometry and Table tiles
  title?: string;
  // url is added so the CLUE core can add an image tile to the document when a user
  // drops an image on the document.
  url?: string;
  // appConfig contains stamps (for drawing tool), placeholderText (for text tool), etc.
  appConfig?: AppConfigModelType;
}

export interface IToolContentInfo {
  id: string;
  modelClass: typeof ToolContentModel;
  defaultContent: (options?: IDefaultContentOptions) => ToolContentModelType;
  titleBase?: string;
  metadataClass?: typeof ToolMetadataModel;
  addSidecarNotes?: boolean;
  defaultHeight?: number;
  exportNonDefaultHeight?: boolean;
  snapshotPostProcessor?: ToolTileModelContentSnapshotPostProcessor;
}

const gToolContentInfoMapById: Record<string, IToolContentInfo> = {};

export function registerToolContentInfo(toolContentInfo: IToolContentInfo) {
  // toLowerCase() for legacy support of tool names
  gToolContentInfoMapById[toolContentInfo.id.toLowerCase()] = toolContentInfo;
}

// ToolContent id, e.g. kDrawingToolID, kGeometryToolID, etc.
// undefined is supported so callers do not need to check the id before passing
// it in.
export function getToolContentInfoById(id?: string) {
  // toLowerCase() for legacy support of tool names
  return id ? gToolContentInfoMapById[id.toLowerCase()] : undefined;
}

export function getToolContentModels() {
  return Object.values(gToolContentInfoMapById).map(info => info.modelClass);
}

export function getToolIds() {
  // the keys are toLowerCased(), so we look up the actual id
  return Object.values(gToolContentInfoMapById).map(info => info.id);
}

export interface ITileExportOptions {
  json?: boolean; // default true, but some tiles (e.g. geometry) use their export code to produce other formats
  includeId?: boolean;
  excludeTitle?: boolean;
  rowHeight?: number;
  transformImageUrl?: (url: string, filename?: string) => string;
}

export interface IDocumentExportOptions extends ITileExportOptions {
  includeTileIds?: boolean;
  appendComma?: boolean;
  transformImageUrl?: (url: string, filename?: string) => string;
}
