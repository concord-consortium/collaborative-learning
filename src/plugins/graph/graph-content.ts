import { types, Instance } from "mobx-state-tree";

import { TileContentModel } from "../../models/tiles/tile-content";
import { kGraphTileType } from "./graph-types";

export function defaultGraphContent(): GraphContentModelType {
  return GraphContentModel.create({text: "Graph Content Placeholder"});
}


export const GraphContentModel = TileContentModel
  .named("GraphTool")
  .props({
    type: types.optional(types.literal(kGraphTileType), kGraphTileType),
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

export interface GraphContentModelType extends Instance<typeof GraphContentModel> {}
