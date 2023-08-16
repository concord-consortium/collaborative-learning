import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kNumberlineTileType } from "./numberline-types";

export function defaultNumberlineContent(): NumberlineContentModelType {
  return NumberlineContentModel.create({});
}

export const NumberlineContentModel = TileContentModel
  .named("NumberlineTool")
  .props({
    type: types.optional(types.literal(kNumberlineTileType), kNumberlineTileType),
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    }
  }))
  .actions(self => ({
  }));

export interface NumberlineContentModelType extends Instance<typeof NumberlineContentModel> {}
