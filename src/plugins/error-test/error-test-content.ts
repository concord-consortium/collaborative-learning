import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kErrorTestTileType } from "./error-test-types";

export function defaultErrorTestContent(): ErrorTestContentModelType {
  return ErrorTestContentModel.create({});
}


export const ErrorTestContentModel = TileContentModel
  .named("ErrorTestTool")
  .props({
    type: types.optional(types.literal(kErrorTestTileType), kErrorTestTileType),
    throwRenderError: true,
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    }
  }));

export interface ErrorTestContentModelType extends Instance<typeof ErrorTestContentModel> {}
