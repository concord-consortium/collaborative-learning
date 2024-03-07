import { createContext } from "react";
import { ToolbarOption } from "./numberline-tile";

export interface INumberlineToolbarContext {
  handleResetPoints: () => void;
  handleDeletePoint: () => void;
  handleCreatePointType: (isOpen: ToolbarOption) => void;
  toolbarOption: ToolbarOption;
}

export const NumberlineToolbarContext = createContext<INumberlineToolbarContext | null>(null);

