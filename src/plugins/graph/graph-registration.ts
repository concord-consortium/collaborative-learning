import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kGraphDefaultHeight, kGraphTileType } from "./graph-types";
import { GraphWrapperComponent } from "./components/graph-wrapper-component";
import { createGraphContentModel, GraphContentModel, GraphMetadataModel } from "./models/graph-content";

import GraphToolIcon from "./graph-icon.svg";

registerTileContentInfo({
  defaultContent: () => createGraphContentModel(),
  defaultHeight: kGraphDefaultHeight,
  modelClass: GraphContentModel,
  metadataClass: GraphMetadataModel,
  titleBase: "X-Y Plot",
  type: kGraphTileType
});

registerTileComponentInfo({
  Component: GraphWrapperComponent,
  Icon: GraphToolIcon,
  tileEltClass: "graph-tool-tile",
  type: kGraphTileType
});
