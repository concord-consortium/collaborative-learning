import { registerToolComponentInfo } from "../../models/tiles/tile-component-info";
import { registerToolContentInfo } from "../../models/tiles/tile-content-info";
import { kStarterDefaultHeight, kStarterToolID } from "./starter-types";
import StarterToolIcon from "./starter-icon.svg";
import { StarterToolComponent } from "./starter-tile";
import { defaultStarterContent, StarterContentModel } from "./starter-content";

registerToolContentInfo({
  id: kStarterToolID,
  modelClass: StarterContentModel,
  defaultContent: defaultStarterContent,
  defaultHeight: kStarterDefaultHeight
});

registerToolComponentInfo({
  id: kStarterToolID,
  Component: StarterToolComponent,
  toolTileClass: "starter-tool-tile",
  Icon: StarterToolIcon
});
