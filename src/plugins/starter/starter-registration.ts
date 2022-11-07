import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kStarterDefaultHeight, kStarterTileType } from "./starter-types";
import StarterToolIcon from "./starter-icon.svg";
import { StarterToolComponent } from "./starter-tile";
import { defaultStarterContent, StarterContentModel } from "./starter-content";

registerTileContentInfo({
  type: kStarterTileType,
  modelClass: StarterContentModel,
  defaultContent: defaultStarterContent,
  defaultHeight: kStarterDefaultHeight
});

registerTileComponentInfo({
  type: kStarterTileType,
  Component: StarterToolComponent,
  tileEltClass: "starter-tool-tile",
  Icon: StarterToolIcon
});
