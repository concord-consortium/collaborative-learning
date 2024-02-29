import { createContext } from "react";

export interface INumberlineToolbarContext {
  handleClearPoints: () => void;
  handleDeletePoint: () => void;
  handleCreatePointType: (isOpen: boolean) => void;
  pointTypeIsOpen: boolean;
}

export const NumberlineToolbarContext = createContext<INumberlineToolbarContext | null>(null);

