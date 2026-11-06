import { createContext, useContext } from "react";

/**
 * The tile element a toolbar belongs to. The toolbar renders in a portal outside the tile, so a
 * toolbar button that needs the tile's position in the document (for example to keep a pane inside
 * the tile's scroll container) can't find it from its own DOM ancestors.
 */
export const TileToolbarTileElementContext = createContext<HTMLElement | null>(null);

export const useTileToolbarTileElement = () => useContext(TileToolbarTileElementContext);

/**
 * Lets a tile that is mid-operation disable its whole toolbar while naming the controls that stay
 * live. Dataflow uses it so that Stop is the only thing clickable during a recording, which it
 * cannot do by editing the buttons: `data-set-view` and `data-set-link` are shared with other tile
 * types, and the zoom/pan buttons don't consult the read-only context.
 *
 * The default must stay inert -- every tile's toolbar buttons run this check.
 */
export interface IToolbarBusyState {
  busy: boolean;
  exempt?: string[];   // button names that stay enabled
}

export const ToolbarBusyContext = createContext<IToolbarBusyState>({ busy: false });
