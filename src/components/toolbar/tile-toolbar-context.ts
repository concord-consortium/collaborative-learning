import { createContext, useContext } from "react";

/**
 * The tile element a toolbar belongs to. The toolbar renders in a portal outside the tile, so a
 * toolbar button that needs the tile's position in the document (for example to keep a pane inside
 * the tile's scroll container) can't find it from its own DOM ancestors.
 */
export const TileToolbarTileElementContext = createContext<HTMLElement | null>(null);

export const useTileToolbarTileElement = () => useContext(TileToolbarTileElementContext);
