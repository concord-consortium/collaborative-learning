import { createContext } from "react";

export interface ITextTileToolbarContext {
  voiceTypingActive: boolean;
  setVoiceTypingActive: (active: boolean) => void;
  interimText: string;
  setInterimText: (text: string) => void;
}

export const TextTileToolbarContext = createContext<ITextTileToolbarContext | null>(null);
