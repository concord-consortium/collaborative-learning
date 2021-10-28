import { ToolContentModel, ToolContentModelType, ToolMetadataModel } from "./tool-types";
import { UnitModelType } from "../curriculum/unit";

export interface IDMap {
  [id: string]: string;
}
export type ToolTileModelContentSnapshotPostProcessor =
              (content: any, idMap: IDMap, asTemplate?: boolean) => any;

export interface IDefaultContentOptions {
  // title is only currently used by the Geometry and Table tiles
  title?: string;
  // url is added so the CLUE core can add a image tile to the document when a user
  // drops an image on the document.
  url?: string;
  // text is really only added to help with tests so the tests can use this
  // code: `content.addTile("text", { text: "foo" });`
  // Perhaps we can remove this.`
  text?: string;
  // unit is added so the drawing tool can use a default set of stamps defined in
  // the unit
  unit?: UnitModelType;
}

export interface IToolContentInfo {
  id: string;
  tool: string;
  titleBase?: string;
  modelClass: typeof ToolContentModel;
  metadataClass?: typeof ToolMetadataModel;
  addSidecarNotes?: boolean;
  defaultHeight?: number;
  exportNonDefaultHeight?: boolean;
  defaultContent: (options?: IDefaultContentOptions) => ToolContentModelType;
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
