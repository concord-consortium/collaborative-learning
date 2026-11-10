import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kAIDefaultHeight, kAITileType } from "./ai-types";
import { AIComponent } from "./ai-tile";
import { defaultAIContent, AIContentModel } from "./ai-content";

import Icon from "./ai-icon.svg";

// Register toolbar buttons (side-effect import)
import "./ai-toolbar-registration";

registerTileContentInfo({
  type: kAITileType,
  displayName: "AI",
  modelClass: AIContentModel,
  defaultContent: defaultAIContent,
  defaultHeight: kAIDefaultHeight,
  // Dropped for the same reason exportJson drops them: they record what this tile last asked
  // about, not what the author wrote, and a copy must evaluate afresh.
  updateContentForCopy: (oldContent: any) => {
    const { evaluatedRequestHash: _, evaluatedAt: __, ...rest } = oldContent;
    return { ...rest, hidePrompt: true };
  }
});

registerTileComponentInfo({
  type: kAITileType,
  Component: AIComponent,
  tileEltClass: "ai-tool-tile",
  Icon,
  HeaderIcon: Icon  // TODO: if this ever becomes a "real" tile (used in student/teacher work) we'll need a HeaderIcon.
});
