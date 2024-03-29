import { createContext } from "react";
import { CreatePointType } from "./numberline-tile";

export interface INumberlineToolbarContext {
  handleResetPoints: () => void;
  handleDeletePoint: () => void;
  handleCreatePointType: (isOpen: CreatePointType) => void;
  toolbarOption: CreatePointType;
}

export const NumberlineToolbarContext = createContext<INumberlineToolbarContext | null>(null);

