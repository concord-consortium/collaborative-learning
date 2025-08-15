import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kAIDefaultHeight, kAITileType } from "./ai-types";
import { AIComponent } from "./ai-tile";
import { defaultAIContent, AIContentModel } from "./ai-content";

import Icon from "./ai-icon.svg";
import HeaderIcon from "./ai-tile-id.svg";
import { switchToTextContent } from "./ai-utils";

registerTileContentInfo({
  type: kAITileType,
  displayName: "AI",
  modelClass: AIContentModel,
  defaultContent: defaultAIContent,
  defaultHeight: kAIDefaultHeight,
  updateContentForCopy: switchToTextContent
});

registerTileComponentInfo({
  type: kAITileType,
  Component: AIComponent,
  tileEltClass: "ai-tool-tile",
  Icon,
  HeaderIcon
});
