import { createContext, useContext } from "react";
import { Optional } from "utility-types";

export interface IGraphSettings {
  disableAttributeDnD: boolean;
  scalePlotOnValueChange: boolean;
  emptyPlotIsNumeric: boolean;
  defaultSeriesLegend: boolean;
  connectPointsByDefault: boolean;
  autoAssignAttributes: boolean;
  defaultAxisLabels: Record<string, string>;
}

export type IGraphSettingsFromStores = Optional<IGraphSettings>;

export const kDefaultGraphSettings: IGraphSettings = {
  disableAttributeDnD: true,
  scalePlotOnValueChange: true,
  emptyPlotIsNumeric: true,
  defaultSeriesLegend: true,
  connectPointsByDefault: true,
  autoAssignAttributes: true,
  defaultAxisLabels: {}
};

export const GraphSettingsContext = createContext<IGraphSettings>(kDefaultGraphSettings);

export const useGraphSettingsContext = () => {
  return useContext(GraphSettingsContext);
};
