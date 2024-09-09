import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kBarGraphTileType, kBarGraphDefaultHeight } from "./bar-graph-types";
import { BarGraphComponent } from "./bar-graph-tile";
import { defaultBarGraphContent, BarGraphContentModel } from "./bar-graph-content";

import Icon from "./assets/bar-graph-icon.svg";

registerTileContentInfo({
  type: kBarGraphTileType,
  displayName: "Bar Graph",
  modelClass: BarGraphContentModel,
  defaultContent: defaultBarGraphContent,
  defaultHeight: kBarGraphDefaultHeight
});

registerTileComponentInfo({
  type: kBarGraphTileType,
  Component: BarGraphComponent,
  tileEltClass: "bar-graph-tile",
  Icon,
  HeaderIcon: Icon // TODO do we need a separate header icon?
});
