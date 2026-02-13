import React, { createContext } from "react";
import { TitleTextInserter } from "../../../components/tiles/editable-tile-title";

export interface IDrawingToolbarContext {
  voiceTypingActive: boolean;
  setVoiceTypingActive: (active: boolean) => void;
  interimText: string;
  setInterimText: (text: string) => void;
  titleEditing: boolean;
  setTitleEditing: (editing: boolean) => void;
  titleTextInserter: TitleTextInserter | null;
  setTitleTextInserter: (inserter: TitleTextInserter | null) => void;
  commitInterimTextRef: React.MutableRefObject<(() => void) | null>;
}

export const DrawingToolbarContext = createContext<IDrawingToolbarContext | null>(null);
