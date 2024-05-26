import{ Dispatch, SetStateAction, createContext, useContext } from 'react';

type DrawingAreaContext = {
  getObjectListPanelWidth: () => number;
  getVisibleCanvasSize: () => { x: number; y: number } | undefined;
  // The URL of an image to add to the drawing area, its react state at top level component
  imageUrlToAdd: string;
  // this is it's setter, previously a prop passed through old toolbar
  setImageUrlToAdd: Dispatch<SetStateAction<string>>;
}

export const DrawingAreaContext = createContext<DrawingAreaContext | undefined>(undefined);
export const useDrawingAreaContext = () => useContext(DrawingAreaContext);
