import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kXYplotDefaultHeight, kXYplotTileType } from "./xyplot-types";
import { XYplotToolComponent } from "./xyplot-tile";
import { defaultXYplotContent, XYplotContentModel } from "./xyplot-content";
import XYplotToolIcon from "./xyplot-icon.svg";

registerTileContentInfo({
  defaultContent: defaultXYplotContent,
  defaultHeight: kXYplotDefaultHeight,
  modelClass: XYplotContentModel,
  type: kXYplotTileType,
});

registerTileComponentInfo({
  Component: XYplotToolComponent,
  Icon: XYplotToolIcon,
  tileEltClass: "xyplot-tool-tile",
  type: kXYplotTileType
});
