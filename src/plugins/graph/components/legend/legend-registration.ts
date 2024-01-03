import { FunctionComponent } from "react";

import { colorIdsOfLayerLegend, heightOfLayerLegend, LayerLegend, layerLegendType } from "./layer-legend";
import { ColorIdListFunction, ILegendPartProps, LegendHeightFunction } from "./legend-types";

interface IMultiLegendPart {
  component: FunctionComponent<ILegendPartProps>;
  getHeight: LegendHeightFunction;
  getColorIdList: ColorIdListFunction;
  type: string;
}

export const multiLegendParts: IMultiLegendPart[] = [
  {
    component: LayerLegend,
    getHeight: heightOfLayerLegend,
    getColorIdList: colorIdsOfLayerLegend,
    type: layerLegendType
  }
];

export function registerMultiLegendPart(part: IMultiLegendPart, start?: boolean) {
  if (start) {
    multiLegendParts.unshift(part);
  } else {
    multiLegendParts.push(part);
  }
}
