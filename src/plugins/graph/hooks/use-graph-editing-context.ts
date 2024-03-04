import { createContext, useContext } from "react";

/**
 * This context holds state relevant to editing points on the Graph tile.
 */

export interface IGraphEditMode {
  addPointsMode: boolean;
  setAddPointsMode: (val: boolean) => void;
  addPoint: (x: number, y: number) => void;
}

const kDefaultGraphEditMode: IGraphEditMode = {
  addPointsMode: false,
  setAddPointsMode: val => { },
  addPoint: (x, y) => { }
};

export const GraphEditingContext = createContext<IGraphEditMode>(kDefaultGraphEditMode);

export const useGraphEditingContext = () => useContext(GraphEditingContext);
