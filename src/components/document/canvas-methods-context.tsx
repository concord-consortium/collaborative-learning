import React, { useContext } from "react";
import { ObjectBoundingBox } from "../../models/annotations/clue-object";

/**
 * Context to give components access to some methods defined at the Canvas level.
 */

// So far there is only one method provided here
export interface ICanvasMethods {
  cacheObjectBoundingBox: (tileId: string, objectId: string, boundingBox: ObjectBoundingBox|undefined) => void;
  /**
   * Returns the current width of the canvas, if available.
   */
  getWidth?: () => number | undefined;
}

export const CanvasMethodsContext = React.createContext<ICanvasMethods|null>(null);

export const useCanvasMethodsContext = () => useContext(CanvasMethodsContext);
