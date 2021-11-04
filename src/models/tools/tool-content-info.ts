import { ToolContentModel, ToolContentModelType, ToolMetadataModel } from "./tool-types";

export interface IDMap {
  [id: string]: string;
}
export type ToolTileModelContentSnapshotPostProcessor =
              (content: any, idMap: IDMap, asTemplate?: boolean) => any;

export interface IToolContentInfo {
  id: string;
  tool: string;
  titleBase?: string;
  modelClass: typeof ToolContentModel;
  metadataClass?: typeof ToolMetadataModel;
  addSidecarNotes?: boolean;
  defaultHeight?: number;
  exportNonDefaultHeight?: boolean;
  defaultContent: (input?: any) => ToolContentModelType;
  snapshotPostProcessor?: ToolTileModelContentSnapshotPostProcessor;
}

interface IToolContentInfoMap {
  [id: string]: IToolContentInfo;
}
const gToolContentInfoMapById: IToolContentInfoMap = {};
const gToolContentInfoMapByTool: IToolContentInfoMap = {};

export function registerToolContentInfo(toolContentInfo: IToolContentInfo) {
  gToolContentInfoMapById[toolContentInfo.id] = toolContentInfo;
  gToolContentInfoMapByTool[toolContentInfo.tool] = toolContentInfo;
}

// ToolContent id, e.g. kDrawingToolID, kGeometryToolID, etc.
export function getToolContentInfoById(id: string) {
  return gToolContentInfoMapById[id];
}

// tool name used in a few places, e.g. "drawing", "geometry", etc.
export function getToolContentInfoByTool(tool: string) {
  return gToolContentInfoMapByTool[tool];
}

export function getToolContentModels() {
  return Object.values(gToolContentInfoMapById).map(info => info.modelClass);
}

export function getToolIds() {
  return Object.keys(gToolContentInfoMapById);
}


export interface ITileExportOptions {
  rowHeight?: number;
  transformImageUrl?: (url: string, filename?: string) => string;
}

export interface IDocumentExportOptions extends ITileExportOptions {
  includeTileIds?: boolean;
  appendComma?: boolean;
}
