import { createContext, useContext } from "react";
import { BoundingBox } from "../../../models/tiles/navigatable-tile-model";

// This context allows a the parent tile to be informed of the region
// of x,y space that is in view in a child tile. This is used by the
// TileNavigator to show what is in view in the tile.

export interface ITileNavigatorContext {
  reportVisibleBoundingBox: (boundingBox: BoundingBox) => void;
}

export const TileNavigatorContext = createContext<ITileNavigatorContext | null>(null);

export const useTileNavigatorContext = () => {
  const context = useContext(TileNavigatorContext);
  if (!context) {
    throw new Error("useTileNavigatorContext must be used within a TileNavigatorContext.Provider");
  }
  return context;
};
