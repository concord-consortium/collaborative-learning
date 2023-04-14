import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kGraphDefaultHeight, kGraphTileType } from "./graph-types";
import { createGraphModel, GraphModel } from "./models/graph-model";
import { GraphWrapperComponent } from "./components/graph-wrapper-component";

import GraphToolIcon from "./graph-icon.svg";

registerTileContentInfo({
  defaultContent: () => createGraphModel(),
  defaultHeight: kGraphDefaultHeight,
  modelClass: GraphModel,
  type: kGraphTileType
});

registerTileComponentInfo({
  Component: GraphWrapperComponent,
  Icon: GraphToolIcon,
  tileEltClass: "graph-tool-tile",
  type: kGraphTileType
});
