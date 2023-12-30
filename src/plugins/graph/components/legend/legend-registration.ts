import { FunctionComponent } from "react";
import { IKeyValueMap } from "mobx";

import { appConfig } from "../../../../initialize-app";
import { JSONValue } from "../../../../models/stores/settings";
import { CodapXLegend, codapXLegendType, heightOfCodapXLegend } from "./codap-x-legend";
import { heightOfLayerLegend, LayerLegend, layerLegendType } from "./layer-legend";
import {
  heightOfVariableFunctionLegend, VariableFunctionLegend, variableFunctionLegendType
} from "./variable-function-legend";
import { ILegendHeightFunctionProps, ILegendPartProps } from "./legend-types";

interface IMultiLegendPart {
  component: FunctionComponent<ILegendPartProps>;
  getHeight: (props: ILegendHeightFunctionProps) => number;
  type: string;
}

export const multiLegendParts: IMultiLegendPart[] = [
  { component: VariableFunctionLegend, getHeight: heightOfVariableFunctionLegend, type: variableFunctionLegendType },
  { component: LayerLegend, getHeight: heightOfLayerLegend, type: layerLegendType }
];

export function registerMultiLegendPart(part: IMultiLegendPart, start?: boolean) {
  if (start) {
    multiLegendParts.unshift(part);
  } else {
    multiLegendParts.push(part);
  }
}

// Register the old codap x legend if we're not using the default (CLUE) legend
const graphSettings = appConfig.config.settings?.graph;
if (graphSettings && !(graphSettings as IKeyValueMap<JSONValue>).defaultSeriesLegend) {
  registerMultiLegendPart(
    { component: CodapXLegend, getHeight: heightOfCodapXLegend, type: codapXLegendType }, true
  );
}
