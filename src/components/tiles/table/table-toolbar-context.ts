import { createContext } from "react";

export interface ITableToolbarContext {
  /** False when the selected column is one the owning tile derives, which has no expression to set. */
  canSetExpression: boolean;
  showExpressionsDialog: () => void;
  deleteSelected: () => void;
  importData: (file: File) => void;
  uploadImage: (file: File) => void;
}

export const TableToolbarContext = createContext<ITableToolbarContext | null>(null);
