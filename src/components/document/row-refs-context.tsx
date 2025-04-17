import React from "react";
import { TileRowHandle } from "./tile-row";

interface IRowRefsContext {
  addRowRef: (elt: TileRowHandle) => void;
}

/**
 * Context to allow Components to register TileRowHandles.
 */
export const RowRefsContext = React.createContext<IRowRefsContext | undefined>(undefined);
