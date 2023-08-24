import { ScaleLinear, ScaleBand } from "d3";
import { ScaleNumericBaseType } from "../imports/components/axis/axis-types";
import { useDataSetContext } from "../imports/hooks/use-data-set-context";
import { useGraphLayoutContext } from "../models/graph-layout";
import { useDataConfigurationContext } from "./use-data-configuration-context";

export const usePointLocations = () => {
  const dataConfiguration = useDataConfigurationContext();
  const layout = useGraphLayoutContext();
  const dataset = useDataSetContext();
  const numExtraPrimaryBands = dataConfiguration?.numRepetitionsForPlace('bottom') ?? 1;
  const numExtraSecondaryBands = dataConfiguration?.numRepetitionsForPlace('left') ?? 1;
  const yAttrIDs = dataConfiguration?.yAttributeIDs || [];
  const hasY2 = dataConfiguration?.hasY2Attribute;
  const v2Scale = layout.getAxisScale("rightNumeric") as ScaleNumericBaseType;
  const yScaleY = layout.getAxisScale("left") as ScaleNumericBaseType;
  const plotsCt = dataConfiguration?.numberOfPlots || 1;
  const caseIds = dataset?.cases.map(c => c.__id__) ?? [];

  const getScreenX = (anID: string) => {
    const xAttrID = dataConfiguration?.attributeID('x') ?? '',
      xValue = dataset?.getNumeric(anID, xAttrID) ?? NaN,
      xScale = layout.getAxisScale('bottom') as ScaleLinear<number, number>,
      topSplitID = dataConfiguration?.attributeID('topSplit') ?? '',
      topCoordValue = dataset?.getStrValue(anID, topSplitID) ?? '',
      topScale = layout.getAxisScale('top') as ScaleBand<string>;
    return xScale(xValue) / numExtraPrimaryBands + (topScale(topCoordValue) || 0);
  };

  const getScreenY = (anID: string, plotNum = 0) => {
    const yAttrID = yAttrIDs[plotNum],
      yValue = dataset?.getNumeric(anID, yAttrID) ?? NaN,
      yScale = (hasY2 && plotNum === plotsCt - 1 ? v2Scale : yScaleY) as ScaleLinear<number, number>,
      rightSplitID = dataConfiguration?.attributeID('rightSplit') ?? '',
      rightCoordValue = dataset?.getStrValue(anID, rightSplitID) ?? '',
      rightScale = layout.getAxisScale('rightCat') as ScaleBand<string>,
      rightScreenCoord = ((rightCoordValue && rightScale(rightCoordValue)) || 0);
    return yScale(yValue) / numExtraSecondaryBands + rightScreenCoord;
  };

  const xSeries: number[] = [];
  const ySeries: number[] = [];

  caseIds?.forEach((caseId) => {
    xSeries.push(getScreenX(caseId));
    ySeries.push(getScreenY(caseId));
  });

  return xSeries.map((x, i) => [x, ySeries[i]]) as Iterable<[number, number]>;
};
