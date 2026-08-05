import stringify from "json-stringify-pretty-compact";
import { types, Instance, getSnapshot } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kAITileType } from "./ai-types";
import { getTileIdFromContent } from "../../models/tiles/tile-model";
import { logTileChangeEvent } from "../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../lib/logger-types";

export const kDefaultAIDescription = "Copy this tile into your workspace to get targeted AI help.";

export function defaultAIContent(): AIContentModelType {
  return AIContentModel.create({});
}

export const AIContentModel = TileContentModel
  .named("AIContent")
  .props({
    type: types.optional(types.literal(kAITileType), kAITileType),
    description: types.optional(types.string, kDefaultAIDescription),
    hidePrompt: types.optional(types.boolean, false),
    prompt: "",
    text: "This is where the dynamically generated AI response will appear.",
    refreshCount: types.optional(types.number, 0)
  })
  .views(self => ({
    get isUserResizable() {
      return false;
    }
  }))
  .actions(self => ({
    logChange(operation: string, change: Record<string, any>) {
      logTileChangeEvent(LogEventName.AI_TOOL_CHANGE, {
        tileId: getTileIdFromContent(self) ?? "", operation, change
      });
    }
  }))
  .actions(self => ({
    exportJson() {
      const { refreshCount: _, ...snapshot } = getSnapshot(self);
      return stringify(snapshot);
    },
    setDescription(desc: string) {
      self.description = desc;
      self.logChange("setDescription", { description: desc });
    },
    setHidePrompt(hide: boolean) {
      self.hidePrompt = hide;
      self.logChange("setHidePrompt", { hidePrompt: hide });
    },
    setPrompt(prompt: string) {
      self.prompt = prompt;
      self.logChange("setPrompt", { prompt });
    },
    setText(text: string) {
      self.text = text;
      self.logChange("setText", { text });
    },
    requestRefresh() {
      self.refreshCount++;
      self.logChange("requestRefresh", { refreshCount: self.refreshCount });
    }
  }));

export interface AIContentModelType extends Instance<typeof AIContentModel> {}
