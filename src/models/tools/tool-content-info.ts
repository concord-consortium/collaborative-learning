import { FunctionComponent, SVGProps } from "react";
import { ToolContentModel, ToolContentModelType, ToolMetadataModel } from "./tool-types";
import { IToolTileProps } from "../../components/tools/tool-tile";
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

type ToolComponentType = React.ComponentType<IToolTileProps>;

export interface IToolContentInfo {
  id: string;
  tool: string;
  modelClass: typeof ToolContentModel;
  defaultContent: (options?: IDefaultContentOptions) => ToolContentModelType;
  Component: ToolComponentType;
  toolTileClass: string;
  Icon?: FunctionComponent<SVGProps<SVGSVGElement>>;
  titleBase?: string;
  metadataClass?: typeof ToolMetadataModel;
  addSidecarNotes?: boolean;
  defaultHeight?: number;
  exportNonDefaultHeight?: boolean;
  snapshotPostProcessor?: ToolTileModelContentSnapshotPostProcessor;
  /**
   * By default the tool tile wrapper ToolTileComponent will handle the selection of the
   * the tile when it gets a mouse down or touch start.
   *
   * If the tool wants to manage its own selection by calling ui.setSelectedTile,
   * it should set tileHandlesOwnSelection to true. This will prevent ToolTileComponent
   * from trying to set the selection.
   */
  tileHandlesOwnSelection?: boolean;
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
