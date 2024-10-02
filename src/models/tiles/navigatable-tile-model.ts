import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { TileContentModel } from "./tile-content";
import { kUnknownTileType } from "./unknown-types";

export const NavigatableTileModel = TileContentModel
  .named("Navigatable Tile")
  .props({
    type: types.optional(types.string, kUnknownTileType),
    isNavigatorVisible : types.optional(types.boolean, true),
    navigatorPosition: types.optional(types.string, "bottom")
  })
  .actions(self => ({
    showNavigator() {
      self.isNavigatorVisible = true;
    },
    hideNavigator() {
      self.isNavigatorVisible = false;
    },
    setNavigatorPosition(position: "top" | "bottom") {
      self.navigatorPosition = position;
    }
}));

export type NavigatableTileModelType = Instance<typeof NavigatableTileModel>;
export type NavigatableTileModelSnapshot = SnapshotIn<typeof NavigatableTileModel>;
