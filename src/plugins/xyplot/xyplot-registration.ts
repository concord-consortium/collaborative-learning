import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kXYplotDefaultHeight, kGraphTileType } from "./xyplot-types";
import { createGraphModel, GraphModel } from "./models/graph-model";
import { GraphComponent } from "./components/graph-component";

import XYplotToolIcon from "./xyplot-icon.svg";

// TODO: Determine what this would be used for in CLUE.
// In CODAP, it's used in registerTileContentInfo. There
// the value is GRPH
export const kGraphIdPrefix = "XYPLOT";

registerTileContentInfo({
  defaultContent: () => createGraphModel(),
  defaultHeight: kXYplotDefaultHeight,
  modelClass: GraphModel,
  type: kGraphTileType
});

// TODO: Determine if more properties are needed. In CODAP, the
// following additional props are included: defaultHeight, defaultWidth
registerTileComponentInfo({
  Component: GraphComponent,
  Icon: XYplotToolIcon,
  tileEltClass: "xyplot-tool-tile",
  type: kGraphTileType
});
