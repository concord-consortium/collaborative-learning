import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kGraphDefaultHeight, kGraphTileType } from "./graph-types";
import { GraphWrapperComponent } from "./components/graph-wrapper-component";
import { createGraphModel, GraphModel } from "./models/graph-model";

import GraphToolIcon from "./graph-icon.svg";

registerTileContentInfo({
  defaultContent: (options) => createGraphModel(undefined, options?.appConfig),
  defaultHeight: kGraphDefaultHeight,
  modelClass: GraphModel,
  titleBase: "X-Y Plot",
  type: kGraphTileType,
  isDataConsumer: true,
  requiresCaseMetadata: true
});

registerTileComponentInfo({
  Component: GraphWrapperComponent,
  Icon: GraphToolIcon,
  tileEltClass: "graph-tool-tile",
  type: kGraphTileType
});
