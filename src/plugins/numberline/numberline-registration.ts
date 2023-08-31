import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kNumberlineDefaultHeight, kNumberlineTileType } from "./numberline-types";
import NumberlineToolIcon from "./assets/numberline-icon.svg";
import { NumberlineToolComponent } from "./numberline-tile";
import { defaultNumberlineContent, NumberlineContentModel } from "./numberline-content";

registerTileContentInfo({
  type: kNumberlineTileType,
  modelClass: NumberlineContentModel,
  defaultContent: defaultNumberlineContent,
  defaultHeight: kNumberlineDefaultHeight
});

registerTileComponentInfo({
  type: kNumberlineTileType,
  Component: NumberlineToolComponent,
  tileEltClass: "numberline-tool-tile",
  Icon: NumberlineToolIcon
});
