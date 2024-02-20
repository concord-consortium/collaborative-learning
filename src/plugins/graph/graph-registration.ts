import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kGraphDefaultHeight, kGraphTileType } from "./graph-types";
import { GraphWrapperComponent } from "./components/graph-wrapper-component";
import { createGraphModel, GraphModel } from "./models/graph-model";
import { updateGraphContentWithNewSharedModelIds, updateGraphObjectWithNewSharedModelIds }
  from "./utilities/graph-utils";

import Icon from "./assets/graph-icon.svg";
import HeaderIcon from "./assets/graph-tile-id.svg";

registerTileContentInfo({
  defaultContent: (options) => createGraphModel(undefined, options?.appConfig),
  defaultHeight: kGraphDefaultHeight,
  modelClass: GraphModel,
  displayName: "Graph",
  type: kGraphTileType,
  isDataConsumer: true,
  updateContentWithNewSharedModelIds: updateGraphContentWithNewSharedModelIds,
  updateObjectReferenceWithNewSharedModelIds: updateGraphObjectWithNewSharedModelIds
});

registerTileComponentInfo({
  Component: GraphWrapperComponent,
  Icon,
  HeaderIcon,
  tileEltClass: "graph-tool-tile",
  type: kGraphTileType
});
