import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kBarGraphTileType } from "./bar-graph-types";

export function defaultBarGraphContent(): BarGraphContentModelType {
  return BarGraphContentModel.create({text: "Hello World"});
}


export const BarGraphContentModel = TileContentModel
  .named("BarGraphContentModel")
  .props({
    type: types.optional(types.literal(kBarGraphTileType), kBarGraphTileType),
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

export interface BarGraphContentModelType extends Instance<typeof BarGraphContentModel> {}
