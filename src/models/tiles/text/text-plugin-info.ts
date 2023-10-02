import { Editor} from "@concord-consortium/slate-editor";
import { SharedModelType } from "../../shared/shared-model";
import { TextContentModelType } from "./text-content";

export interface ITextPlugin {
  onInitEditor?: (editor: Editor) => Editor;
  dispose?: () => void;
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
