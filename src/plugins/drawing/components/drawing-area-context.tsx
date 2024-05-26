import{ createContext, useContext } from 'react';

type DrawingAreaContext = {
  getObjectListPanelWidth: () => number;
  getVisibleCanvasSize: () => { x: number; y: number } | undefined;
};

export const DrawingAreaContext = createContext<DrawingAreaContext | undefined>(undefined);
export const useDrawingAreaContext = () => useContext(DrawingAreaContext);
