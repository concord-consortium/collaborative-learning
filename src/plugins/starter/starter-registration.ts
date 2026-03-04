import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kStarterDefaultHeight, kStarterTileType } from "./starter-types";
import { StarterToolComponent } from "./starter-tile";
import { defaultStarterContent, StarterContentModel } from "./starter-content";

import Icon from "./starter-icon.svg";
import HeaderIcon from "./starter-tile-id.svg";

registerTileContentInfo({
  type: kStarterTileType,
  displayName: "Starter",
  modelClass: StarterContentModel,
  defaultContent: defaultStarterContent,
  defaultHeight: kStarterDefaultHeight
});

registerTileComponentInfo({
  type: kStarterTileType,
  Component: StarterToolComponent,
  tileEltClass: "starter-tool-tile",
  Icon,
  HeaderIcon,
  hiddenTitle: true
});
