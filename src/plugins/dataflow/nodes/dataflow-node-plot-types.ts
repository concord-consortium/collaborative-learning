import { NodePlotColor } from "../model/utilities/node";

export interface MinigraphOptions {
  backgroundColor?: string;
  borderColor?: string;
}

export const defaultMinigraphOptions: MinigraphOptions = {
  backgroundColor: NodePlotColor,
  borderColor: NodePlotColor
};

/**
 * A node's declaration of how one of its watched values is graphed. `toPlot` converts the stored
 * value into the units the node's field shows; `min`/`max` are the axis in those same units.
 * Both come from the one declaration so the trace and the axis cannot disagree.
 */
export interface IPlotScale {
  toPlot?: (value: number) => number;
  min?: number;
  max?: number;
}
