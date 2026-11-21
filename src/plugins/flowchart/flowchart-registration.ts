import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kFlowchartDefaultHeight, kFlowchartTileType } from "./flowchart-types";
import { FlowchartToolComponent } from "./flowchart-tile";
import { defaultFlowchartContent, FlowchartContentModel } from "./flowchart-content";

import Icon from "./flowchart-icon.svg";
import HeaderIcon from "./flowchart-tile-id.svg";

registerTileContentInfo({
  type: kFlowchartTileType,
  displayName: "Flowchart",
  modelClass: FlowchartContentModel,
  defaultContent: defaultFlowchartContent,
  defaultHeight: kFlowchartDefaultHeight
});

registerTileComponentInfo({
  type: kFlowchartTileType,
  Component: FlowchartToolComponent,
  tileEltClass: "flowchart-tool-tile",
  Icon,
  HeaderIcon
});
