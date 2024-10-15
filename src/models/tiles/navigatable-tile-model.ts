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
    offsetX: types.optional(types.number, 0),
    offsetY: types.optional(types.number, 0),
    zoom: types.optional(types.number, 1)
  })
  .views(() => ({
    get objectsBoundingBox(): BoundingBox | undefined {
      // derived models should override
      console.warn("Derived models should override objectsBoundingBox.");
      return undefined;
    }
  }))
  .views(self => ({
    contentSize(): { width: number, height: number } {
      // derived models should override
      console.warn("Derived models should override contentSize.");
      return { width: 0, height: 0 };
    },
    contentFitsViewport(tileWidth: number, tileHeight: number, unavailableSpace=0): boolean {
      // derived models should override
      console.warn("Derived models should override contentFitsViewport.");
      return false;
    }
  }))
  .views(self => ({
    calculateOffset(canvasSize: {x: number, y: number}, targetZoom: number): Point {
      // Calculate offset required to keep the content centered in the viewport.
      const offsetXCentered = (canvasSize.x * (targetZoom / self.zoom - 1)) / 2;
      const offsetYCentered = (canvasSize.y * (targetZoom / self.zoom - 1)) / 2;

      // Add panning offsets.
      const finalOffsetX = self.offsetX - offsetXCentered * self.zoom;
      const finalOffsetY = self.offsetY - offsetYCentered * self.zoom;

      return { x: finalOffsetX, y: finalOffsetY };
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
    setOffset(x: number, y: number) {
      self.offsetX = x;
      self.offsetY = y;
    },
    setZoom(zoom: number, canvasSize?: {x: number, y: number}) {
      // Adjust the offset to keep content centered in the viewport when zoom level changes.
      if (canvasSize) {
        const newOffsetX = self.calculateOffset(canvasSize, zoom).x;
        const newOffsetY = self.calculateOffset(canvasSize, zoom).y;
        self.offsetX = newOffsetX;
        self.offsetY = newOffsetY;
      }

      self.zoom = zoom;
    }
}));

export type NavigatableTileModelType = Instance<typeof NavigatableTileModel>;
export type NavigatableTileModelSnapshot = SnapshotIn<typeof NavigatableTileModel>;

export const isNavigatableTileModel = (model: any): model is NavigatableTileModelType => {
  return "isNavigatorVisible" in model && "navigatorPosition" in model;
};
