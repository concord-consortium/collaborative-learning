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

// Module-level logging helper following the logBarGraphEvent/logGeometryEvent convention, so the
// setters stay pure mutations. Call sites log deliberately (on blur/commit, not on every keystroke).
export function logAiEvent(model: AIContentModelType, operation: string, change: Record<string, any>) {
  logTileChangeEvent(LogEventName.AI_TOOL_CHANGE, {
    tileId: getTileIdFromContent(model) ?? "", operation, change
  });
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
    exportJson() {
      const { refreshCount: _, ...snapshot } = getSnapshot(self);
      return stringify(snapshot);
    },
    // The setters below are pure mutations wired to controlled inputs (they fire on every keystroke).
    // Logging happens deliberately from the component's blur handlers via logAiEvent, not here.
    setDescription(desc: string) {
      self.description = desc;
    },
    setHidePrompt(hide: boolean) {
      self.hidePrompt = hide;
    },
    setPrompt(prompt: string) {
      self.prompt = prompt;
    },
    // setText is only called by the AI-response effect on mount/refresh, never by a student, so it must
    // not emit an answer-change event. The student-triggered requestRefresh below is what gets logged.
    setText(text: string) {
      self.text = text;
    },
    requestRefresh() {
      self.refreshCount++;
      logAiEvent(self as AIContentModelType, "requestRefresh", { refreshCount: self.refreshCount });
    }
  }));

export interface AIContentModelType extends Instance<typeof AIContentModel> {}
