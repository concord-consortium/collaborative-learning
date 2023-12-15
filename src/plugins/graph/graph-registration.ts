import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kGraphDefaultHeight, kGraphTileType } from "./graph-types";
import { GraphWrapperComponent } from "./components/graph-wrapper-component";
import { createGraphModel, GraphModel } from "./models/graph-model";
import { updateGraphObjectWithNewSharedModelIds } from "./utilities/graph-utils";

import GraphToolIcon from "./assets/graph-icon.svg";

registerTileContentInfo({
  defaultContent: (options) => createGraphModel(undefined, options?.appConfig),
  defaultHeight: kGraphDefaultHeight,
  modelClass: GraphModel,
  titleBase: "Graph",
  type: kGraphTileType,
  isDataConsumer: true,
  updateObjectReferenceWithNewSharedModelIds: updateGraphObjectWithNewSharedModelIds
});

registerTileComponentInfo({
  Component: GraphWrapperComponent,
  Icon: GraphToolIcon,
  tileEltClass: "graph-tool-tile",
  type: kGraphTileType
});
