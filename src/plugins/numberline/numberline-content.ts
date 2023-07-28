import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kNumberlineTileType } from "./numberline-types";

export function defaultNumberlineContent(): NumberlineContentModelType {
  return NumberlineContentModel.create({text: "Numberline Tile"});
}

export const NumberlineContentModel = TileContentModel
  .named("NumberlineTool")
  .props({
    type: types.optional(types.literal(kNumberlineTileType), kNumberlineTileType),
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

export interface NumberlineContentModelType extends Instance<typeof NumberlineContentModel> {}
