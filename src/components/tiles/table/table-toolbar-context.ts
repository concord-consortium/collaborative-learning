import { createContext } from "react";

export interface ITableToolbarContext {
  showExpressionsDialog: () => void;
  deleteSelected: () => void;
  importData: (file: File) => void;
}

export const TableToolbarContext = createContext<ITableToolbarContext | null>(null);
