import { ToolContentModel, ToolContentModelType, ToolMetadataModel } from "./tool-types";
import { UnitModelType } from "../curriculum/unit";
import { IToolTileProps } from "../../components/tools/tool-tile";

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
  // unit is added so the drawing tool can use a default set of stamps defined in
  // the unit
  unit?: UnitModelType;
}

type ToolComponentType = React.ComponentType<IToolTileProps>;

export interface IToolContentInfo {
  id: string;
  tool: string;
  modelClass: typeof ToolContentModel;
  defaultContent: (options?: IDefaultContentOptions) => ToolContentModelType;
  Component: ToolComponentType;
  toolTileClass: string;
  titleBase?: string;
  metadataClass?: typeof ToolMetadataModel;
  addSidecarNotes?: boolean;
  defaultHeight?: number;
  exportNonDefaultHeight?: boolean;
  snapshotPostProcessor?: ToolTileModelContentSnapshotPostProcessor;
  /**
   * If the tile component doesn't call ui.setSelectedTile itself, then it can
   * add  tileHandlesSelection: true and the tool-tile wrapper will handle the
   * selection instead
   * I think the name of this property is referring to ToolTileComponent as the "tile".
   * So a tool is saying I don't handle my selection let my "tile" do it for me.
   * Currently this is used by the table and drawing tools.
   *
   * This approach was first added in the commit below, this helps clarify its purpose:
   * https://github.com/concord-consortium/collaborative-learning/commit/d19b201dfd2c635aae2f30672c50610f90ba07a5
   */
  tileHandlesSelection?: boolean;
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
