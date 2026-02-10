import { createContext } from "react";

export interface IDrawingToolbarContext {
  voiceTypingActive: boolean;
  setVoiceTypingActive: (active: boolean) => void;
  interimText: string;
  setInterimText: (text: string) => void;
}

export const DrawingToolbarContext = createContext<IDrawingToolbarContext | null>(null);
