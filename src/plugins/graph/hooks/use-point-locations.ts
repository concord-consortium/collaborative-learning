import { ScaleLinear, ScaleBand } from "d3";
import { ScaleNumericBaseType } from "../imports/components/axis/axis-types";
import { GraphLayout, useGraphLayoutContext } from "../models/graph-layout";
import { IDataConfigurationModel } from "../models/data-configuration-model";
import { IDataSet } from "../../../models/data/data-set";
import { useGraphModelContext } from "../hooks/use-graph-model-context";

interface GetScreenXYParams {
  caseId: string;
  dataset?: IDataSet;
  layout: GraphLayout;
  dataConfig?: IDataConfigurationModel;
  plotNum?: number;
}

// These functions are modelled after the getScreenX and getScreenY functions in scatterdots.tsx
export const getScreenX = ({ caseId, dataset, layout, dataConfig}: GetScreenXYParams) => {
  const xAttrID = dataConfig?.attributeID('x') ?? '';
  const xValue = dataset?.getNumeric(caseId, xAttrID) ?? NaN;
  const xScale = layout.getAxisScale('bottom') as ScaleLinear<number, number>;
  const topSplitID = dataConfig?.attributeID('topSplit') ?? '';
  const topCoordValue = dataset?.getStrValue(caseId, topSplitID) ?? '';
  const topScale = layout.getAxisScale('top') as ScaleBand<string>;
  const numExtraPrimaryBands = dataConfig?.numRepetitionsForPlace('bottom') ?? 1;
  return xScale(xValue) / numExtraPrimaryBands + (topScale(topCoordValue) || 0);
};

export const getScreenY = ({ caseId, dataset, layout, dataConfig, plotNum = 0 }: GetScreenXYParams) => {
  const yAttrIDs = dataConfig?.yAttributeIDs || [];
  const hasY2 = dataConfig?.hasY2Attribute;
  const plotsCt = dataConfig?.numberOfPlots || 1;
  const yAttrID = yAttrIDs[plotNum];
  const yValue = dataset?.getNumeric(caseId, yAttrID) ?? NaN;
  const yScaleRole = hasY2 && plotNum === plotsCt - 1 ? "rightNumeric" : "left";
  const yScale = layout.getAxisScale(yScaleRole) as ScaleNumericBaseType;
  const rightSplitID = dataConfig?.attributeID('rightSplit') ?? '';
  const rightCoordValue = dataset?.getStrValue(caseId, rightSplitID) ?? '';
  const rightScale = layout.getAxisScale('rightCat') as ScaleBand<string>;
  const rightScreenCoord = ((rightCoordValue && rightScale(rightCoordValue.toString())) || 0);
  const numExtraSecondaryBands = dataConfig?.numRepetitionsForPlace('left') ?? 1;
  return yScale(yValue) / numExtraSecondaryBands + rightScreenCoord;
};

export const usePointLocations = () => {
  const layout = useGraphLayoutContext();
  const graphModel = useGraphModelContext();
  const result: Record<string, Iterable<[number, number]>> = {};
  // Outer loop over layer
  for (const layer of graphModel.layers) {
    const dataConfig = layer.config;
    const dataset = dataConfig.dataset;
    const caseIds = dataset?.cases.map(c => c.__id__) ?? [];
    // Loop over plotNum (which series in the layer)
    if (dataConfig) {
      for (let plotNum = 0; plotNum < dataConfig.yAttributeDescriptions.length; ++plotNum) {
        // Inner loop over cases in that series
        const series: [number, number][] = [];
        caseIds.forEach((caseId) => {
          if (dataConfig && dataset && layout) {
            const xValue = getScreenX({ caseId, dataset, layout, dataConfig });
            const yValue = getScreenY({ caseId, dataset, layout, dataConfig, plotNum });
            if (isFinite(xValue) && isFinite(yValue)) {
              series.push([xValue, yValue]);
            }
          }
        });
        const attributeId = dataConfig.yAttributeID(plotNum);
        result[attributeId] = series;
      }
    }
  }
  return result;
};
