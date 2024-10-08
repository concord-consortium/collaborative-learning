import { types, Instance, SnapshotIn } from "mobx-state-tree";

import { TileContentModel } from "./tile-content";
import { kUnknownTileType } from "./unknown-types";

type NavigatorPosition = "top" | "bottom";
export type NavigatorDirection = "up" | "right" | "down" | "left";

export interface Point { x: number; y: number; }

export interface BoundingBox {
  nw: Point;
  se: Point;
  start?: Point;
  end?: Point;
}

export const NavigatableTileModel = TileContentModel
  .named("Navigatable Tile")
  .props({
    type: types.optional(types.string, kUnknownTileType),
    isNavigatorVisible: types.optional(types.boolean, true),
    navigatorPosition: types.optional(types.string, "bottom"),
    zoom: types.optional(types.number, 1)
  })
  .views(() => ({
    get objectsBoundingBox(): BoundingBox | undefined {
      // derived models should override
      console.warn("Derived models should override objectsBoundingBox.");
      return undefined;
    }
  }))
  .actions(self => ({
    showNavigator() {
      self.isNavigatorVisible = true;
    },
    hideNavigator() {
      self.isNavigatorVisible = false;
    },
    setNavigatorPosition(position: NavigatorPosition) {
      self.navigatorPosition = position;
    },
    setZoom(zoom: number) {
      self.zoom = zoom;
    }
}));

export type NavigatableTileModelType = Instance<typeof NavigatableTileModel>;
export type NavigatableTileModelSnapshot = SnapshotIn<typeof NavigatableTileModel>;

export const isNavigatableTileModel = (model: any): model is NavigatableTileModelType => {
  return "isNavigatorVisible" in model && "navigatorPosition" in model;
};
