import { FunctionComponent } from "react";

import { heightOfLayerLegend, LayerLegend, layerLegendType } from "./layer-legend";
import { ILegendHeightFunctionProps, ILegendPartProps } from "./legend-types";

interface IMultiLegendPart {
  component: FunctionComponent<ILegendPartProps>;
  getHeight: (props: ILegendHeightFunctionProps) => number;
  type: string;
}

export const multiLegendParts: IMultiLegendPart[] = [
  { component: LayerLegend, getHeight: heightOfLayerLegend, type: layerLegendType }
];

export function registerMultiLegendPart(part: IMultiLegendPart, start?: boolean) {
  if (start) {
    multiLegendParts.unshift(part);
  } else {
    multiLegendParts.push(part);
  }
}
