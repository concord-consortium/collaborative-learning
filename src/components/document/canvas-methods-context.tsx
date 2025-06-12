import React, { useContext } from "react";
import { ObjectBoundingBox } from "../../models/annotations/clue-object";

/**
 * Context to give components access to some methods defined at the Canvas level.
 */

export interface ICanvasMethods {
  /**
   * Add a BoundingBox to the cache.
   */
  cacheObjectBoundingBox: (tileId: string, objectId: string, boundingBox: ObjectBoundingBox|undefined) => void;
  /**
   * Return the current width of the canvas, if available.
   */
  getWidth?: () => number | undefined;
}

export const CanvasMethodsContext = React.createContext<ICanvasMethods|null>(null);

export const useCanvasMethodsContext = () => useContext(CanvasMethodsContext);
