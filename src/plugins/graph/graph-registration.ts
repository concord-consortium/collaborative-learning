import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kGraphDefaultHeight, kGraphTileType } from "./graph-types";
import { createGraphModel, GraphModel } from "./models/graph-model";
import { GraphComponent } from "./components/graph-component";

import GraphToolIcon from "./graph-icon.svg";

registerTileContentInfo({
  defaultContent: () => createGraphModel(),
  defaultHeight: kGraphDefaultHeight,
  modelClass: GraphModel,
  type: kGraphTileType
});

// TODO: Determine if more properties are needed. In CODAP, the
// following additional props are included: defaultHeight, defaultWidth, shelf
registerTileComponentInfo({
  Component: GraphComponent,
  Icon: GraphToolIcon,
  tileEltClass: "graph-tool-tile",
  type: kGraphTileType
});
