import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kNumberlineTileDefaultHeight, kNumberlineTileType } from "../numberline/numberline-tile-constants";
import NumberlineToolIcon from "./assets/numberline-icon.svg";
import { NumberlineTile } from "./components/numberline-tile";
import { defaultNumberlineContent, NumberlineContentModel } from "./models/numberline-content";

registerTileContentInfo({
  type: kNumberlineTileType,
  modelClass: NumberlineContentModel,
  defaultContent: defaultNumberlineContent,
  defaultHeight: kNumberlineTileDefaultHeight
});

registerTileComponentInfo({
  type: kNumberlineTileType,
  Component: NumberlineTile,
  tileEltClass: "numberline-tool-tile",
  Icon: NumberlineToolIcon
});
