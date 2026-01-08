import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kAIDefaultHeight, kAITileType } from "./ai-types";
import { AIComponent } from "./ai-tile";
import { defaultAIContent, AIContentModel } from "./ai-content";

import Icon from "./ai-icon.svg";

registerTileContentInfo({
  type: kAITileType,
  displayName: "AI",
  modelClass: AIContentModel,
  defaultContent: defaultAIContent,
  defaultHeight: kAIDefaultHeight,
  // updateContentForCopy: switchToTextContent
});

registerTileComponentInfo({
  type: kAITileType,
  Component: AIComponent,
  tileEltClass: "ai-tool-tile",
  Icon,
  HeaderIcon: Icon   // TODO: if this ever becomes a "real" tile (used in student/teacher work) we'll need a HeaderIcon.
});
