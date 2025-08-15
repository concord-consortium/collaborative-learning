import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kAITileType } from "./ai-types";

export function defaultAIContent(): AIContentModelType {
  return AIContentModel.create({});
}

export const AIContentModel = TileContentModel
  .named("AIContent")
  .props({
    type: types.optional(types.literal(kAITileType), kAITileType),
    prompt: "",
    text: ""
  })
  .views(self => ({
    get isUserResizable() {
      return false;
    }
  }))
  .actions(self => ({
    setPrompt(prompt: string) {
      self.prompt = prompt;
    },
    setText(text: string) {
      self.text = text;
    }
  }));

export interface AIContentModelType extends Instance<typeof AIContentModel> {}
