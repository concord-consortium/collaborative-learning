import React from "react";
import { IDropRowInfo } from "../../models/document/tile-row";

/**
 * Context to provide drag and drop row information to nested components.
 * This includes information about where a dragged item can be dropped.
 */
export const DropRowContext = React.createContext<IDropRowInfo | undefined>(undefined);
