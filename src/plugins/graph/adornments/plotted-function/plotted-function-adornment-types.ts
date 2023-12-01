export const kPlottedFunctionClass = "plotted-function";
export const kPlottedFunctionType = "Plotted Function";
export const kPlottedFunctionPrefix = "ADRN";
export const kPlottedFunctionLabelKey = "DG.Inspector.graphPlottedFunction";
export const kPlottedFunctionUndoAddKey = "DG.Undo.graph.showPlotFunction";
export const kPlottedFunctionRedoAddKey = "DG.Redo.graph.showPlotFunction";
export const kPlottedFunctionUndoRemoveKey = "DG.Undo.graph.hidePlotFunction";
export const kPlottedFunctionRedoRemoveKey = "DG.Redo.graph.hidePlotFunction";
export const kPlottedFunctionValueTitleKey = "DG.PlottedFunction.valueTitle";

export type FormulaFn = (x: number) => number;
