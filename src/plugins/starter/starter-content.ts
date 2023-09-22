import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kStarterTileType } from "./starter-types";

export function defaultStarterContent(): StarterContentModelType {
  return StarterContentModel.create({ text: "Hello World" });
}


export const StarterContentModel = TileContentModel
  .named("StarterTool")
  .props({
    type: types.optional(types.literal(kStarterTileType), kStarterTileType),
    text: "",
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    }
  }))
  .actions(self => ({
    setText(text: string) {
      self.text = text;
    }
  }));

export interface StarterContentModelType extends Instance<typeof StarterContentModel> {}
