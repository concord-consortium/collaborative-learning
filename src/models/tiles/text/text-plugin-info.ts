import { Editor, EditorValue } from "@concord-consortium/slate-editor";
import { IClueTileObject, IOffsetModel, ObjectBoundingBox } from "../../annotations/clue-object";
import { SharedModelType } from "../../shared/shared-model";
import { IStores } from "../../stores/stores";
import { TextContentModelType } from "./text-content";

export interface ITextPlugin {
  onInitEditor?: (editor: Editor) => Editor;
  dispose?: () => void;
  getObjectBoundingBox?: (id: string, type?: string) => ObjectBoundingBox | undefined;
  getObjectDefaultOffsets?: (id: string, type?: string) => IOffsetModel | undefined;
  handleSlateValueChange?: (value: EditorValue) => void;
  initializeFromValue?: (value: EditorValue) => void;
  // Optional post-construction setter for plugins that need access to application
  // stores and the owning tile id (e.g., to clean up annotations attached to chips
  // the user edited out). createSlatePlugin(textContent) doesn't expose either.
  setTileContext?: (stores: IStores, tileId: string) => void;
}

export interface IButtonDefProps {
  pluginInstance?: ITextPlugin;
}

export type ButtonDefComponent = React.FC<IButtonDefProps>;

export interface ITextPluginInfo {
  pluginName: string;
  createSlatePlugin?:
    (textContent: TextContentModelType) => ITextPlugin;
  updateTextContentAfterSharedModelChanges?:
    (textContent: TextContentModelType, sharedModel?: SharedModelType) => void;
  getAnnotatableObjects?: (textContent: TextContentModelType) => IClueTileObject[];
}

const gTextPluginInfoMap: Record<string, ITextPluginInfo | undefined> = {};

export function registerTextPluginInfo(textToolInfo: ITextPluginInfo) {
  gTextPluginInfoMap[textToolInfo.pluginName] = textToolInfo;
}

export function getTextPluginInfo(id: string) {
  return gTextPluginInfoMap[id];
}

// TODO: perhaps this should only add the plugins that have been configured
// as tools by the app-config.
export function createTextPluginInstances(textContent: TextContentModelType) {
  const pluginInstances:  Record<string, ITextPlugin|undefined> = {};
  Object.values(gTextPluginInfoMap).forEach(pluginInfo => {
    if (pluginInfo?.createSlatePlugin) {
      pluginInstances[pluginInfo.pluginName] = pluginInfo.createSlatePlugin(textContent);
    }
  });
  return pluginInstances;
}

export function getTextPluginIds() {
  return Object.keys(gTextPluginInfoMap);
}

export function getAllTextPluginInfos() {
  return Object.values(gTextPluginInfoMap);
}
