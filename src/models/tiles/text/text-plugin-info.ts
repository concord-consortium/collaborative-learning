import { VariableType } from "@concord-consortium/diagram-view";
import { ModalType } from "@concord-consortium/react-modal-hook";
import { FunctionComponent, SVGProps } from "react";
import { SharedVariablesType } from "src/plugins/shared-variables/shared-variables";
import { SharedModelType } from "../../shared/shared-model";
import { TextContentModelType } from "./text-content";

export interface ITextPluginInfo {
  iconName: string;
  Icon: FunctionComponent<SVGProps<SVGSVGElement>>;
  toolTip: string;
  createSlatePlugin?:
    (textContent: TextContentModelType) => any; //FIXME: This needs a type.
  command: (args?:any)=> any; // FIXME: types
  updateTextContentAfterSharedModelChanges?:
    (textContent: TextContentModelType, sharedModel?: SharedModelType) => void;
  buttonEnabled?: (args:any)=>any,  // FIXME: types
}

const gTextPluginInfoMap: Record<string, ITextPluginInfo | undefined> = {};

export function registerTextPluginInfo(textToolInfo: ITextPluginInfo) {
  gTextPluginInfoMap[textToolInfo.iconName] = textToolInfo;
}

export function getTextPluginInfo(id: string) {
  return gTextPluginInfoMap[id];
}

// TODO: perhaps this should only add the plugins that have been configured
// as tools by the app-config.
export function getTextPluginInstances(textContent: TextContentModelType) {
  // FIXME: need to figure out what this should be
  const pluginInstances:  any[] = []; // FIXME type
  Object.values(gTextPluginInfoMap).forEach(pluginInfo => {
    if (pluginInfo?.createSlatePlugin) {
      pluginInstances.push(pluginInfo.createSlatePlugin(textContent));
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
