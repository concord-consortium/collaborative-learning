import { HtmlSerializablePlugin } from "@concord-consortium/slate-editor";
import { FunctionComponent, SVGProps } from "react";
import { TextContentModelType } from "./text-content";

export interface ITextPluginInfo {
  iconName: string;
  Icon: FunctionComponent<SVGProps<SVGSVGElement>>;
  toolTip: string;
  createSlatePlugin?: (textContent: TextContentModelType) => HtmlSerializablePlugin;
  command?: string;
}

const gTextPluginInfoMap: Record<string, ITextPluginInfo | undefined> = {};

export function registerPluginToolInfo(textToolInfo: ITextPluginInfo) {
  gTextPluginInfoMap[textToolInfo.iconName] = textToolInfo;
}

export function getTextPluginInfo(id: string) {
  return gTextPluginInfoMap[id];
}

export function getTextPluginInstances(textContent: TextContentModelType) {
  const pluginInstances:  HtmlSerializablePlugin[] = [];
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
