import { createContext, useContext } from "react";

export interface IGraphSettings {
  disableAttributeDnD: boolean
  scalePlotOnValueChange: boolean,
  emptyPlotIsNumeric: boolean,
  defaultSeriesLegend: boolean,
  connectPointsByDefault: boolean,
  autoAssignAttributes: boolean,
  defaultAxisLabels: Record<string, string> | undefined
}

export const GraphSettingsContext = createContext<IGraphSettings>({
  disableAttributeDnD: true,
  scalePlotOnValueChange: true,
  emptyPlotIsNumeric: true,
  defaultSeriesLegend: true,
  connectPointsByDefault: true,
  autoAssignAttributes: true,
  defaultAxisLabels: undefined
});

export const useGraphSettingsContext = () => {
  return useContext(GraphSettingsContext);
};
