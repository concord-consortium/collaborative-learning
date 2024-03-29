import { createContext } from "react";

export interface ITableToolbarContext {
  showExpressionsDialog: () => void;
  deleteSelected: () => void;
}

export const TableToolbarContext = createContext<ITableToolbarContext | null>(null);
