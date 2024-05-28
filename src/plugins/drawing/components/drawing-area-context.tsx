import{ Dispatch, SetStateAction, createContext, useContext } from 'react';

type DrawingAreaContext = {
  getObjectListPanelWidth: () => number;
  getVisibleCanvasSize: () => { x: number; y: number } | undefined;
  imageUrlToAdd: string;
  setImageUrlToAdd: Dispatch<SetStateAction<string>>;
}

export const DrawingAreaContext = createContext<DrawingAreaContext | undefined>(undefined);
export const useDrawingAreaContext = () => useContext(DrawingAreaContext);
