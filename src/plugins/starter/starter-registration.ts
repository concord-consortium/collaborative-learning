import { registerToolContentInfo } from "../../models/tools/tool-content-info";
import { kStarterDefaultHeight, kStarterToolID } from "./starter-types";
import StarterToolIcon from "./starter-icon.svg";
import { StarterToolComponent } from "./starter-tool";
import { defaultStarterContent, StarterContentModel } from "./starter-content";

registerToolContentInfo({
    id: kStarterToolID,
    modelClass: StarterContentModel,
    defaultContent: defaultStarterContent,
    Component: StarterToolComponent,
    defaultHeight: kStarterDefaultHeight,
    toolTileClass: "starter-tool-tile",
    Icon: StarterToolIcon
  });