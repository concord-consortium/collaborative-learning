export interface IDMap {
  [id: string]: string;
}
export type ToolTileModelContentSnapshotPostProcessor =
              (content: any, idMap: IDMap) => any;

export interface IToolContentInfo {
  id: string;
  tool: string;
  modelClass: any;
  metadataClass?: any;
  addSidecarNotes?: boolean;
  defaultHeight?: number;
  defaultContent: (input?: any) => any;
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

export function getToolContentInfoById(id: string) {
  return gToolContentInfoMapById[id];
}

export function getToolContentInfoByTool(tool: string) {
  return gToolContentInfoMapByTool[tool];
}
