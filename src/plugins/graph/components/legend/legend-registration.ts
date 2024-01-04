import { FunctionComponent } from "react";

import { getLayerLegendIdList, heightOfLayerLegend, LayerLegend, layerLegendType } from "./layer-legend";
import { LegendIdListFunction, ILegendPartProps, LegendHeightFunction } from "./legend-types";

interface IMultiLegendPart {
  component: FunctionComponent<ILegendPartProps>;
  getHeight: LegendHeightFunction;
  getLegendIdList: LegendIdListFunction;
  type: string;
}

export const multiLegendParts: IMultiLegendPart[] = [
  {
    component: LayerLegend,
    getHeight: heightOfLayerLegend,
    getLegendIdList: getLayerLegendIdList,
    type: layerLegendType
  }
];

export function registerMultiLegendPart(part: IMultiLegendPart, prepend?: boolean) {
  if (prepend) {
    multiLegendParts.unshift(part);
  } else {
    multiLegendParts.push(part);
  }
}
