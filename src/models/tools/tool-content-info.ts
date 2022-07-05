import { FunctionComponent, SVGProps } from "react";
import { ToolContentModel, ToolContentModelType, ToolMetadataModel } from "./tool-types";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { AppConfigModelType } from "../stores/app-config-model";
import { SharedModel } from "./shared-model";

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

export interface ISharedModelInfo {
  type: string;
  modelClass: typeof SharedModel;
}

const gSharedModelInfoMap: Record<string, ISharedModelInfo> = {};

export function registerSharedModelInfo(sharedModelInfo: ISharedModelInfo) {
  gSharedModelInfoMap[sharedModelInfo.type] = sharedModelInfo;
}

export function getSharedModelClasses() {
  return Object.values(gSharedModelInfoMap).map(info => info.modelClass);
}

export function getSharedModelInfoByType(type: string) {
  return type ? gSharedModelInfoMap[type] : undefined;
}
