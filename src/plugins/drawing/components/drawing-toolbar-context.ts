import { createContext } from "react";

export interface IDrawingToolbarContext {
  interimText: string;
  setInterimText: (text: string) => void;
}

export const DrawingToolbarContext = createContext<IDrawingToolbarContext | null>(null);
