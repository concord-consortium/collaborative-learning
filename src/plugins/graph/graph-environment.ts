import { IAnyStateTreeNode } from "mobx-state-tree";
import { getAppConfig } from "../../models/tiles/tile-environment";

const GraphSettings = ["emptyPlotIsNumeric", "scalePlotOnValueChange"] as const;
type GraphSetting = typeof GraphSettings[number];

export function getGraphSetting(node?: IAnyStateTreeNode, setting?: GraphSetting) {
  const appConfig = getAppConfig(node);
  return setting && appConfig?.getSetting(setting, "graph");
}
