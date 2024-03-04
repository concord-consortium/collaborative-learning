import { createContext, useContext } from "react";

/**
 * This context holds state relevant to editing points on the Graph tile.
 */

export type IGraphEditMode = "none"|"edit"|"add";
export interface IGraphEditModeContext {
  editPointsMode: boolean;
  addPointsMode: boolean;
  setEditMode: (mode: IGraphEditMode) => void;
  addPoint: (x: number, y: number) => void;
  getEditablePointsColor: () => string;
}

const kDefaultGraphEditModeContext: IGraphEditModeContext = {
  editPointsMode: false,
  addPointsMode: false,
  setEditMode: mode => { },
  addPoint: (x, y) => { },
  getEditablePointsColor: () => "#000000"
};

export const GraphEditingContext = createContext<IGraphEditModeContext>(kDefaultGraphEditModeContext);

export const useGraphEditingContext = () => useContext(GraphEditingContext);
