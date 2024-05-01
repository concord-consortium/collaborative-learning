import { createContext } from "react";

export interface ITableContext {
  linked: boolean;
}

/**
 * Global properties of the table that subcomponents might need.
 * At the moment we are only using this for one value, but there may
 * be more in the future.
 */
export const TableContext = createContext<ITableContext | null>(null);
