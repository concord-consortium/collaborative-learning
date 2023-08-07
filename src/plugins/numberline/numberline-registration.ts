import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kNumberlineDefaultHeight, kNumberlineTileType } from "./types/numberline-types";
import NumberlineToolIcon from "./assets/numberline-icon.svg";
import { NumberlineTileWrapperComponent } from "./numberline-tile-wrapper";
import { defaultNumberlineContent, NumberlineContentModel } from "./models/numberline-content";

registerTileContentInfo({
  type: kNumberlineTileType,
  modelClass: NumberlineContentModel,
  defaultContent: defaultNumberlineContent,
  defaultHeight: kNumberlineDefaultHeight
});

registerTileComponentInfo({
  type: kNumberlineTileType,
  Component: NumberlineTileWrapperComponent,
  tileEltClass: "numberline-tool-tile",
  Icon: NumberlineToolIcon
});
