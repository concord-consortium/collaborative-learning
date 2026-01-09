import stringify from "json-stringify-pretty-compact";
import { types, Instance, getSnapshot } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kAITileType } from "./ai-types";

export function defaultAIContent(): AIContentModelType {
  return AIContentModel.create({});
}

export const AIContentModel = TileContentModel
  .named("AIContent")
  .props({
    type: types.optional(types.literal(kAITileType), kAITileType),
    displayPrompt: types.optional(types.boolean, true),
    prompt: "",
    text: "This is where the dynamically generated AI response will appear."
  })
  .views(self => ({
    get isUserResizable() {
      return false;
    }
  }))
  .actions(self => ({
    exportJson() {
      const snapshot = getSnapshot(self);
      return stringify(snapshot);
    },
    setDisplayPrompt(display: boolean) {
      self.displayPrompt = display;
    },
    setPrompt(prompt: string) {
      self.prompt = prompt;
    },
    setText(text: string) {
      self.text = text;
    }
  }));

export interface AIContentModelType extends Instance<typeof AIContentModel> {}
