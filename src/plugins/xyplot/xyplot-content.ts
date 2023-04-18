import { types, Instance } from "mobx-state-tree";

import { TileContentModel } from "../../models/tiles/tile-content";
import { kXYplotTileType } from "./xyplot-types";

export function defaultXYplotContent(): XYplotContentModelType {
  return XYplotContentModel.create({text: "XYplot Content Placeholder"});
}


export const XYplotContentModel = TileContentModel
  .named("XYplotTool")
  .props({
    type: types.optional(types.literal(kXYplotTileType), kXYplotTileType),
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

export interface XYplotContentModelType extends Instance<typeof XYplotContentModel> {}
