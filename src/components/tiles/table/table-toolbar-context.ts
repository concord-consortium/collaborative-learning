import { createContext } from "react";

export interface ITableToolbarContext {
  /** False when the selected column's formula is hidden, so it has no expression to set. */
  canSetExpression: boolean;
  showExpressionsDialog: () => void;
  deleteSelected: () => void;
  importData: (file: File) => void;
  uploadImage: (file: File) => void;
}

export const TableToolbarContext = createContext<ITableToolbarContext | null>(null);
