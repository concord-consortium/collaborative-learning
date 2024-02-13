import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kNumberlineTileDefaultHeight, kNumberlineTileType } from "../numberline/numberline-tile-constants";
import { NumberlineTile } from "./components/numberline-tile";
import { defaultNumberlineContent, NumberlineContentModel } from "./models/numberline-content";

import Icon from "./assets/numberline-icon.svg";
import HeaderIcon from "./assets/number-line-tile-id.svg";

registerTileContentInfo({
  type: kNumberlineTileType,
  displayName: "Number Line",
  modelClass: NumberlineContentModel,
  defaultContent: defaultNumberlineContent,
  defaultHeight: kNumberlineTileDefaultHeight
});

registerTileComponentInfo({
  type: kNumberlineTileType,
  Component: NumberlineTile,
  tileEltClass: "numberline-tool-tile",
  Icon,
  HeaderIcon
});
